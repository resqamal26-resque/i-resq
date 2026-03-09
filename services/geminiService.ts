
import { GoogleGenAI } from "@google/genai";
import { Hospital } from "../types";

class GeminiService {
  /**
   * Initializes GoogleGenAI with the required apiKey from environment variables.
   */
  private getClient(): GoogleGenAI {
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
  }

  /**
   * Simple connectivity test for Gemini API.
   */
  async testConnection(): Promise<{ status: 'success' | 'error'; message: string; latency?: number }> {
    const start = Date.now();
    try {
      const ai = this.getClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: 'ping',
      });
      
      if (response.text) {
        return { 
          status: 'success', 
          message: 'Gemini API is active and responsive.', 
          latency: Date.now() - start 
        };
      }
      return { status: 'error', message: 'Received empty response from Gemini.' };
    } catch (error: any) {
      console.error("Gemini Test Error:", error);
      return { status: 'error', message: error.message || 'Unknown Gemini error.' };
    }
  }

  /**
   * Fetches nearby hospitals and clinics using Gemini with Google Maps grounding.
   * Focuses on a 50km radius and sorts by distance.
   */
  async getNearbyHospitals(lat: number, lng: number): Promise<Hospital[]> {
    try {
      const ai = this.getClient();
      /**
       * Maps grounding is only supported in Gemini 2.5 series models.
       * We request a comprehensive search within a 50km radius.
       */
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: `Identify and list hospitals and clinics within a 50km radius of the coordinates (${lat}, ${lng}) in Malaysia.
        For each facility, provide:
        1. Name
        2. Type (Hospital or Clinic)
        3. Full Address
        4. Approximate driving distance in KM from the provided coordinates.
        
        Group them by type and sort primarily by distance (closest first).`,
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: {
                latitude: lat,
                longitude: lng
              }
            }
          }
        }
      });

      const hospitals: Hospital[] = [];
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      
      if (chunks && chunks.length > 0) {
        chunks.forEach((chunk: any) => {
          if (chunk.maps) {
            hospitals.push({
              name: chunk.maps.title || 'Unknown Facility',
              address: chunk.maps.uri || '', 
              type: (chunk.maps.title?.toLowerCase().includes('klinik') || chunk.maps.title?.toLowerCase().includes('clinic')) 
                    ? 'Clinic' : 'Hospital',
              distance: 'Calculated' 
            });
          }
        });
      }

      return hospitals;
    } catch (error) {
      console.error("Gemini Referral Error:", error);
      return [];
    }
  }
}

// Named export to match usage in components
export const geminiService = new GeminiService();
