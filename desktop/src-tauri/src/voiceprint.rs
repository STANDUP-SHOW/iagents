use std::error::Error;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VoicePrint {
    pub id: String,
    pub user_id: String,
    pub mfcc_features: Vec<Vec<f32>>, // MFCC for each utterance
    pub enrollment_date: String,
    pub is_active: bool,
}

pub struct VoicePrintService;

impl VoicePrintService {
    /// Extract MFCC features from audio samples
    /// Simplified MFCC computation (full implementation would use external library)
    pub fn extract_mfcc_features(audio_samples: &[i16], sample_rate: u32) -> Vec<f32> {
        // Convert i16 to f32 normalized [-1.0, 1.0]
        let normalized: Vec<f32> = audio_samples
            .iter()
            .map(|&s| s as f32 / 32768.0)
            .collect();

        // Simple energy-based features as MFCC placeholder
        // In production: use librosa or similar audio processing library
        let frame_size = (sample_rate / 100) as usize; // 10ms frames
        let mut features = Vec::new();

        for chunk in normalized.chunks(frame_size) {
            if chunk.len() >= 2 {
                // Zero crossing rate (voice activity indicator)
                let zcr = Self::compute_zero_crossing_rate(chunk);
                // Energy (loudness indicator)
                let energy = Self::compute_energy(chunk);
                // Spectral centroid approximation
                let spectral = Self::compute_spectral_approximation(chunk);

                features.push(zcr);
                features.push(energy);
                features.push(spectral);
            }
        }

        features
    }

    fn compute_zero_crossing_rate(samples: &[f32]) -> f32 {
        let mut crossings = 0;
        for i in 1..samples.len() {
            if (samples[i] >= 0.0) != (samples[i - 1] >= 0.0) {
                crossings += 1;
            }
        }
        crossings as f32 / samples.len() as f32
    }

    fn compute_energy(samples: &[f32]) -> f32 {
        samples.iter().map(|s| s * s).sum::<f32>() / samples.len() as f32
    }

    fn compute_spectral_approximation(samples: &[f32]) -> f32 {
        // Approximation of spectral centroid
        let mut sum = 0.0;
        for (i, &sample) in samples.iter().enumerate() {
            sum += i as f32 * sample.abs();
        }
        sum / samples.len() as f32 / 1000.0 // Normalize
    }

    /// Create voice print from multiple enrollment utterances
    pub fn create_voice_print(
        user_id: &str,
        utterances: Vec<Vec<i16>>,
        sample_rate: u32,
    ) -> Result<VoicePrint, Box<dyn Error>> {
        if utterances.is_empty() {
            return Err("No utterances provided for enrollment".into());
        }

        let mut all_features = Vec::new();

        for utterance in utterances {
            let features = Self::extract_mfcc_features(&utterance, sample_rate);
            all_features.push(features);
        }

        Ok(VoicePrint {
            id: format!("vp_{}", uuid_simple()),
            user_id: user_id.to_string(),
            mfcc_features: all_features,
            enrollment_date: chrono_now(),
            is_active: true,
        })
    }

    /// Compare voice sample against voice print
    /// Returns similarity score 0.0 (no match) to 1.0 (exact match)
    pub fn verify_voice(sample: &[i16], voice_print: &VoicePrint, sample_rate: u32) -> f32 {
        let sample_features = Self::extract_mfcc_features(sample, sample_rate);

        // Compare against all enrollment utterances
        let mut similarities = Vec::new();

        for enrolled_features in &voice_print.mfcc_features {
            let similarity = Self::compute_similarity(&sample_features, enrolled_features);
            similarities.push(similarity);
        }

        // Return average similarity against all enrollments
        if similarities.is_empty() {
            0.0
        } else {
            similarities.iter().sum::<f32>() / similarities.len() as f32
        }
    }

    fn compute_similarity(features1: &[f32], features2: &[f32]) -> f32 {
        if features1.is_empty() || features2.is_empty() {
            return 0.0;
        }

        let min_len = features1.len().min(features2.len());
        let mut sum = 0.0;

        for i in 0..min_len {
            let diff = (features1[i] - features2[i]).abs();
            sum += 1.0 / (1.0 + diff); // Inverse distance similarity
        }

        sum / min_len as f32
    }
}

fn uuid_simple() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let time = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    format!("{:x}", time)
}

/// La date d'enregistrement d'une empreinte vocale.
///
/// Elle rendait la chaîne `"2026-09-19T00:00:00Z"`, toujours la même : une
/// empreinte posée en novembre se disait enregistrée en septembre. Le
/// calendrier vit une seule fois, dans `tache::civil`.
fn chrono_now() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secondes = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    crate::tache::date_rfc3339(secondes)
}
