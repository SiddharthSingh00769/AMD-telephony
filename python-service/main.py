# python-service/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import os
import requests
import tempfile
import torch
import librosa
import numpy as np
from typing import Literal
import time
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Get Twilio credentials
TWILIO_ACCOUNT_SID = os.getenv("TWILIO_ACCOUNT_SID")
TWILIO_AUTH_TOKEN = os.getenv("TWILIO_AUTH_TOKEN")

# Initialize FastAPI
app = FastAPI(title="AMD HuggingFace Service", version="2.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request/Response models
class AMDRequest(BaseModel):
    """Request model for AMD analysis"""
    audio_url: str = Field(..., description="URL to the audio recording")
    call_id: str = Field(..., min_length=1, description="Unique call identifier")

class AMDResponse(BaseModel):
    """Response model for AMD analysis"""
    result: Literal["human", "machine", "unknown"]
    confidence: float = Field(..., ge=0.0, le=1.0, description="Confidence score 0.0-1.0")
    reasoning: str = Field(..., min_length=1, description="Human-readable explanation")
    detection_time: int = Field(..., ge=0, description="Processing time in milliseconds")
    model_used: str = Field(default="heuristic-based", description="Model or method used")

# Initialize model on startup
@app.on_event("startup")
async def load_model():
    print("🤖 AMD HuggingFace Service starting...")
    print(f"🔐 Twilio SID configured: {bool(TWILIO_ACCOUNT_SID)}")
    print(f"🔐 Twilio Token configured: {bool(TWILIO_AUTH_TOKEN)}")
    
    if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
        print("⚠️ WARNING: Twilio credentials not found in .env!")
        print("   Make sure TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN are set")
    
    print("✅ Service ready with enhanced voicemail detection!")

@app.get("/")
async def root():
    return {
        "service": "AMD HuggingFace Service",
        "version": "2.0.0",
        "status": "running",
        "features": ["voicemail-detection", "human-detection", "silence-detection"],
        "twilio_configured": bool(TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN)
    }

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "twilio_auth": bool(TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN)
    }

@app.post("/analyze", response_model=AMDResponse)
async def analyze_audio(request: AMDRequest) -> AMDResponse:
    start_time = time.time()
    temp_audio_path = None
    
    try:
        print(f"\n🎙️ Analyzing call: {request.call_id}")
        print(f"📡 Audio URL: {request.audio_url}")
        
        # Validate Twilio credentials
        if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN:
            raise HTTPException(
                status_code=500,
                detail="Twilio credentials not configured. Check .env file."
            )
        
        # Download audio from Twilio
        print("📥 Downloading audio with Twilio auth...")
        audio_response = requests.get(
            request.audio_url,
            auth=(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN),
            timeout=30
        )
        
        if audio_response.status_code != 200:
            print(f"❌ Download failed: HTTP {audio_response.status_code}")
            raise HTTPException(
                status_code=400,
                detail=f"Failed to download audio: HTTP {audio_response.status_code}"
            )
        
        print(f"✅ Downloaded {len(audio_response.content)} bytes")
        
        # Save to temporary file
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_audio:
            temp_audio.write(audio_response.content)
            temp_audio_path = temp_audio.name
        
        print(f"💾 Saved to: {temp_audio_path}")
        
        # Load and process audio
        print("🔊 Loading audio with librosa...")
        try:
            audio, sample_rate = librosa.load(temp_audio_path, sr=16000, mono=True)
            print(f"✅ Loaded: {len(audio)} samples at {sample_rate}Hz")
        except Exception as e:
            print(f"❌ librosa error: {e}")
            raise HTTPException(status_code=400, detail=f"Audio processing failed: {str(e)}")
        
        # Validate audio
        if len(audio) == 0:
            raise HTTPException(status_code=400, detail="Audio file is empty")
        
        full_duration = len(audio) / sample_rate
        print(f"⏱️ Full Duration: {full_duration:.2f}s")
        
        # ====== SMART DETECTION: FIND ALL SPEECH SEGMENTS ======
        
        # Detect all speech segments in the entire audio
        all_intervals = librosa.effects.split(audio, top_db=30)
        
        if len(all_intervals) == 0:
            print("⚠️ No speech detected in entire recording")
            return AMDResponse(
                result="unknown",
                confidence=0.65,
                reasoning="No speech detected in entire recording - possible silence or connection issue",
                detection_time=int((time.time() - start_time) * 1000),
                model_used="librosa-smart-detection-v2"
            )
        
        print(f"\n🔍 Found {len(all_intervals)} speech segments in full recording:")
        
        # Analyze each segment
        segment_info = []
        for i, (start, end) in enumerate(all_intervals):
            start_time_sec = start / sample_rate
            end_time_sec = end / sample_rate
            duration_sec = (end - start) / sample_rate
            segment_audio = audio[start:end]
            segment_energy = np.sqrt(np.mean(segment_audio**2))
            
            print(f"   Segment {i+1}: {start_time_sec:.2f}s - {end_time_sec:.2f}s "
                  f"(duration: {duration_sec:.2f}s, energy: {segment_energy:.4f})")
            
            segment_info.append({
                'index': i,
                'start_time': start_time_sec,
                'end_time': end_time_sec,
                'duration': duration_sec,
                'energy': segment_energy,
                'start_sample': start,
                'end_sample': end
            })
        
        # ====== IDENTIFY THE "ANSWER" SEGMENT ======
        # The answer is typically:
        # - After 5-10 seconds (after trial message)
        # - Before the last 8 seconds (before TwiML greeting)
        # - Has reasonable energy (not background noise)
        
        # Filter segments that could be the answer
        potential_answer_segments = []
        
        for seg in segment_info:
            # Must start after 5 seconds (trial message usually done)
            # Must end before total_duration - 8 seconds (TwiML greeting area)
            if seg['start_time'] >= 5.0 and seg['end_time'] <= (full_duration - 8.0):
                # Must have reasonable energy (not just noise)
                if seg['energy'] > 0.015:
                    potential_answer_segments.append(seg)
                    print(f"   ✅ Segment {seg['index']+1} is potential answer "
                          f"({seg['start_time']:.1f}s-{seg['end_time']:.1f}s)")
        
        if len(potential_answer_segments) == 0:
            print("\n⚠️ No speech in answer window (5s to -8s from end)")
            return AMDResponse(
                result="unknown",
                confidence=0.70,
                reasoning="No speech detected in expected answer window - likely silent or call quality issue",
                detection_time=int((time.time() - start_time) * 1000),
                model_used="librosa-smart-detection-v2"
            )
        
        # ====== ANALYZE THE ANSWER SEGMENTS ======
        
        # Combine all potential answer segments for analysis
        answer_start = potential_answer_segments[0]['start_time']
        answer_end = potential_answer_segments[-1]['end_time']
        answer_duration = answer_end - answer_start
        
        # Extract the answer region
        answer_start_sample = int(answer_start * sample_rate)
        answer_end_sample = int(answer_end * sample_rate)
        answer_audio = audio[answer_start_sample:answer_end_sample]
        
        print(f"\n🎯 Analyzing answer region: {answer_start:.2f}s to {answer_end:.2f}s")
        print(f"📏 Answer duration: {answer_duration:.2f}s")
        print(f"🗣️ Number of speech bursts in answer: {len(potential_answer_segments)}")
        
        # Calculate statistics for answer segments
        total_speech_duration = sum(seg['duration'] for seg in potential_answer_segments)
        silence_in_answer = answer_duration - total_speech_duration
        speech_ratio = total_speech_duration / answer_duration if answer_duration > 0 else 0
        
        avg_segment_duration = np.mean([seg['duration'] for seg in potential_answer_segments])
        max_segment_duration = max([seg['duration'] for seg in potential_answer_segments])
        avg_energy = np.mean([seg['energy'] for seg in potential_answer_segments])
        
        # Calculate gaps between segments (silence patterns)
        gaps = []
        for i in range(len(potential_answer_segments) - 1):
            gap = potential_answer_segments[i+1]['start_time'] - potential_answer_segments[i]['end_time']
            gaps.append(gap)
        avg_gap = np.mean(gaps) if len(gaps) > 0 else 0
        
        print(f"\n📊 Answer Analysis:")
        print(f"   Total speech: {total_speech_duration:.2f}s ({speech_ratio:.1%})")
        print(f"   Silence: {silence_in_answer:.2f}s ({1-speech_ratio:.1%})")
        print(f"   Speech bursts: {len(potential_answer_segments)}")
        print(f"   Avg burst length: {avg_segment_duration:.2f}s")
        print(f"   Max burst length: {max_segment_duration:.2f}s")
        print(f"   Avg energy: {avg_energy:.4f}")
        print(f"   Avg gap between bursts: {avg_gap:.2f}s")
        
        # ====== ENHANCED DECISION LOGIC WITH VOICEMAIL DETECTION ======
        
        score = 0
        reasons = []
        voicemail_indicators = 0  # Track strong voicemail signs
        
        # ========== VOICEMAIL-SPECIFIC DETECTION ==========
        
        # VOICEMAIL RULE 1: Long continuous speech (biggest indicator!)
        # Humans rarely speak >6s continuously, voicemails often do
        if max_segment_duration > 8.0:
            score -= 10
            voicemail_indicators += 3
            reasons.append(f"⚠️ VOICEMAIL: Extremely long continuous speech ({max_segment_duration:.1f}s)")
        elif max_segment_duration > 6.0:
            score -= 7
            voicemail_indicators += 3
            reasons.append(f"⚠️ VOICEMAIL: Very long continuous speech ({max_segment_duration:.1f}s)")
        elif max_segment_duration > 4.5:
            score -= 4
            voicemail_indicators += 2
            reasons.append(f"⚠️ VOICEMAIL: Long continuous speech ({max_segment_duration:.1f}s)")
        elif max_segment_duration > 3.5:
            score -= 2
            voicemail_indicators += 1
            reasons.append(f"Moderately long speech segment ({max_segment_duration:.1f}s)")
        
        # VOICEMAIL RULE 2: High speech ratio (voicemails talk a lot!)
        # Only penalize if VERY high ratio - humans can talk too
        if speech_ratio > 0.90:
            score -= 8
            voicemail_indicators += 3
            reasons.append(f"⚠️ VOICEMAIL: Almost continuous talking ({speech_ratio:.0%})")
        elif speech_ratio > 0.80:
            score -= 5
            voicemail_indicators += 2
            reasons.append(f"⚠️ VOICEMAIL: Mostly continuous speech ({speech_ratio:.0%})")
        elif speech_ratio > 0.70:
            score -= 2
            voicemail_indicators += 1
            reasons.append(f"High speech ratio ({speech_ratio:.0%})")
        
        # VOICEMAIL RULE 3: Few speech segments with long duration
        # This is key: Voicemails = 1-2 long segments, Humans = multiple shorter
        if len(potential_answer_segments) == 1 and total_speech_duration > 5.0:
            score -= 9
            voicemail_indicators += 3
            reasons.append(f"⚠️ VOICEMAIL: Single very long message ({total_speech_duration:.1f}s)")
        elif len(potential_answer_segments) <= 2 and total_speech_duration > 6.0:
            score -= 7
            voicemail_indicators += 3
            reasons.append(f"⚠️ VOICEMAIL: Few segments ({len(potential_answer_segments)}) but very long duration ({total_speech_duration:.1f}s)")
        elif len(potential_answer_segments) <= 2 and total_speech_duration > 4.0:
            score -= 4
            voicemail_indicators += 1
            reasons.append(f"Limited segments with long duration")
        
        # VOICEMAIL RULE 4: Total speech duration
        # Humans typically talk 1-4s when answering, voicemails 6-15s
        if total_speech_duration > 9.0:
            score -= 9
            voicemail_indicators += 3
            reasons.append(f"⚠️ VOICEMAIL: Very extended talking time ({total_speech_duration:.1f}s)")
        elif total_speech_duration > 7.0:
            score -= 6
            voicemail_indicators += 2
            reasons.append(f"⚠️ VOICEMAIL: Extended talking time ({total_speech_duration:.1f}s)")
        elif total_speech_duration > 5.5:
            score -= 3
            voicemail_indicators += 1
            reasons.append(f"Long talking duration ({total_speech_duration:.1f}s)")
        
        # VOICEMAIL RULE 5: Very small gaps (scripted speech has minimal pauses)
        # Only penalize VERY small gaps - humans can speak quickly too
        if len(gaps) > 0 and avg_gap < 0.2:
            score -= 4
            voicemail_indicators += 2
            reasons.append(f"⚠️ VOICEMAIL: Almost no pauses ({avg_gap:.2f}s) - scripted flow")
        elif len(gaps) > 0 and avg_gap < 0.4:
            score -= 2
            voicemail_indicators += 1
            reasons.append(f"Very short pauses - possibly scripted")
        
        # VOICEMAIL RULE 6: Consistent segment lengths (machines are uniform)
        if len(potential_answer_segments) >= 2:
            segment_durations = [seg['duration'] for seg in potential_answer_segments]
            duration_std = np.std(segment_durations)
            duration_variance = np.var(segment_durations)
            
            if duration_std < 0.3 and avg_segment_duration > 2.0:
                score -= 5
                voicemail_indicators += 2
                reasons.append(f"⚠️ VOICEMAIL: Uniform long segments - scripted pattern")
            elif duration_variance < 0.15:
                score -= 2
                voicemail_indicators += 1
                reasons.append("Consistent segment lengths")
        
        # VOICEMAIL RULE 7: Answer region is too long
        # Humans greet quickly (1-4s), voicemails are longer (7-15s)
        if answer_duration > 10.0 and speech_ratio > 0.7:
            score -= 7
            voicemail_indicators += 3
            reasons.append(f"⚠️ VOICEMAIL: Very extended answer window ({answer_duration:.1f}s) with high speech")
        elif answer_duration > 7.0 and speech_ratio > 0.6:
            score -= 4
            voicemail_indicators += 2
            reasons.append(f"⚠️ VOICEMAIL: Extended answer window ({answer_duration:.1f}s) with high speech")
        elif answer_duration > 5.5 and speech_ratio > 0.5:
            score -= 2
            voicemail_indicators += 1
            reasons.append(f"Long answer window ({answer_duration:.1f}s)")
        
        # ========== HUMAN-SPECIFIC DETECTION ==========
        
        # HUMAN RULE 1: Very brief responses (typical "Hello?")
        if total_speech_duration < 1.5 and len(potential_answer_segments) <= 2:
            score += 8
            reasons.append(f"✅ HUMAN: Brief greeting ({total_speech_duration:.1f}s)")
        elif total_speech_duration < 3.0 and len(potential_answer_segments) <= 3:
            score += 6
            reasons.append(f"✅ HUMAN: Short response ({total_speech_duration:.1f}s)")
        elif total_speech_duration < 4.5:
            score += 3
            reasons.append(f"✅ HUMAN: Reasonable response length ({total_speech_duration:.1f}s)")
        
        # HUMAN RULE 2: Multiple short bursts (conversation pattern)
        # Humans often have 2-5 segments when responding
        if len(potential_answer_segments) >= 4 and avg_segment_duration < 2.0:
            score += 7
            reasons.append(f"✅ HUMAN: Multiple brief utterances ({len(potential_answer_segments)} bursts)")
        elif len(potential_answer_segments) >= 3 and avg_segment_duration < 2.5:
            score += 5
            reasons.append(f"✅ HUMAN: Conversational pattern ({len(potential_answer_segments)} bursts)")
        elif len(potential_answer_segments) >= 2 and avg_segment_duration < 1.5:
            score += 4
            reasons.append(f"✅ HUMAN: Quick back-and-forth pattern")
        
        # HUMAN RULE 3: Low speech ratio with multiple segments (listening more than talking)
        if speech_ratio < 0.35 and len(potential_answer_segments) >= 2:
            score += 6
            reasons.append(f"✅ HUMAN: Mostly listening ({speech_ratio:.0%}) - responding to caller")
        elif speech_ratio < 0.50:
            score += 3
            reasons.append(f"Balanced listening/speaking ({speech_ratio:.0%})")
        
        # HUMAN RULE 4: Long gaps (thinking/listening pauses)
        if len(gaps) > 0 and avg_gap > 1.0:
            score += 5
            reasons.append(f"✅ HUMAN: Long pauses ({avg_gap:.2f}s) - natural conversation")
        elif len(gaps) > 0 and avg_gap > 0.7:
            score += 3
            reasons.append(f"Natural pauses between responses")
        
        # HUMAN RULE 5: Quick initial response
        first_segment_start = potential_answer_segments[0]['start_time']
        if first_segment_start < 6.5 and total_speech_duration < 3.0:
            score += 5
            reasons.append(f"✅ HUMAN: Quick brief greeting")
        elif first_segment_start < 7.5 and total_speech_duration < 5.0:
            score += 3
            reasons.append(f"✅ HUMAN: Prompt response")
        elif first_segment_start < 8.0:
            score += 1
            reasons.append("Reasonable response time")
        
        # HUMAN RULE 6: Variable segment lengths (natural speech varies)
        if len(potential_answer_segments) >= 3:
            segment_durations = [seg['duration'] for seg in potential_answer_segments]
            duration_std = np.std(segment_durations)
            
            if duration_std > 0.5:
                score += 4
                reasons.append(f"✅ HUMAN: Highly varied speech patterns")
            elif duration_std > 0.3:
                score += 2
                reasons.append("Natural variation in speech")
        
        # HUMAN RULE 7: Good energy but not too perfect
        if 0.030 < avg_energy < 0.070:
            score += 3
            reasons.append("✅ HUMAN: Natural voice energy")
        elif avg_energy < 0.020:
            score -= 2
            reasons.append("Weak signal")
        
        # ========== OVERRIDE LOGIC ==========
        
        # If we have 3+ strong voicemail indicators, force machine result
        if voicemail_indicators >= 3:
            score = min(score, -10)  # Ensure negative score
            print(f"🚨 VOICEMAIL OVERRIDE: {voicemail_indicators} strong indicators detected")
        
        # If score is negative and we have voicemail indicators, boost the negative score
        if score < 0 and voicemail_indicators >= 2:
            score -= 3
            print(f"⚠️ Voicemail pattern reinforcement: {voicemail_indicators} indicators")
        
        print(f"\n🎯 Final Score: {score}")
        print(f"🤖 Voicemail Indicators: {voicemail_indicators}")
        print(f"📝 Scoring breakdown:")
        for reason in reasons:
            print(f"   - {reason}")
        
        # ====== FINAL DECISION WITH IMPROVED THRESHOLDS ======
        
        if score >= 8:
            result = "human"
            confidence = min(0.95, 0.80 + (score - 8) * 0.02)
            reasoning = "Strong human indicators: " + "; ".join([r for r in reasons if "✅ HUMAN" in r][:3])
        elif score >= 4:
            result = "human"
            confidence = 0.70 + (score - 4) * 0.025
            reasoning = "Likely human: " + "; ".join([r for r in reasons if "✅ HUMAN" in r or "VOICEMAIL" not in r][:3])
        elif score <= -8:
            result = "machine"
            confidence = min(0.95, 0.80 + (abs(score) - 8) * 0.02)
            reasoning = "Strong voicemail indicators: " + "; ".join([r for r in reasons if "⚠️ VOICEMAIL" in r][:3])
        elif score <= -4:
            result = "machine"
            confidence = 0.70 + (abs(score) - 4) * 0.025
            reasoning = "Likely voicemail: " + "; ".join([r for r in reasons if "⚠️ VOICEMAIL" in r or "HUMAN" not in r][:3])
        elif score <= -1:
            result = "machine"
            confidence = 0.60 + abs(score) * 0.03
            reasoning = "Voicemail pattern detected: " + "; ".join([r for r in reasons if "⚠️" in r][:2])
        elif score >= 1:
            result = "human"
            confidence = 0.60 + score * 0.03
            reasoning = "Human pattern detected: " + "; ".join([r for r in reasons if "✅" in r][:2])
        else:
            result = "unknown"
            confidence = 0.50
            reasoning = "Ambiguous pattern: " + "; ".join(reasons[:2])
        
        # Additional confidence adjustment based on voicemail indicators
        if result == "machine" and voicemail_indicators >= 3:
            confidence = min(0.95, confidence + 0.10)
        
        detection_time = int((time.time() - start_time) * 1000)
        
        print(f"\n✅ FINAL RESULT: {result.upper()}")
        print(f"📊 Confidence: {confidence:.2f} ({confidence*100:.0f}%)")
        print(f"💭 Reasoning: {reasoning}")
        print(f"⏱️ Processing time: {detection_time}ms\n")
        
        return AMDResponse(
            result=result,
            confidence=confidence,
            reasoning=reasoning,
            detection_time=detection_time,
            model_used="librosa-smart-detection-v2-voicemail-enhanced"
        )
        
    except HTTPException:
        raise
    
    except Exception as e:
        print(f"❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Analysis failed: {str(e)}")
    
    finally:
        if temp_audio_path and os.path.exists(temp_audio_path):
            try:
                os.unlink(temp_audio_path)
                print("🗑️ Cleaned up temp file")
            except Exception as e:
                print(f"⚠️ Cleanup warning: {e}")

if __name__ == "__main__":
    import uvicorn
    print("🚀 Starting AMD HuggingFace Service v2.0 with Enhanced Voicemail Detection...")
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")