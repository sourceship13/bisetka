/**
 * Card Image Generation Service
 * Handles generation of custom card backgrounds and card backs using OpenAI API
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'YOUR_API_KEY_HERE';
const API_BASE_URL = 'https://api.openai.com/v1/images/generations';

export interface GenerateImageParams {
  prompt: string;
  size?: '1024x1024' | '1024x1536' | '1536x1024';
  quality?: 'standard' | 'hd';
  style?: 'vivid' | 'natural';
  model?: 'dall-e-3' | 'dall-e-2';
}

export interface GeneratedImage {
  url: string;
  revisedPrompt?: string;
}

/**
 * Generate a card background texture
 */
export async function generateCardBackground(
  userPrompt: string
): Promise<GeneratedImage> {
  const fullPrompt = `Playing card background texture: ${userPrompt}, seamless tileable pattern, modern design, high quality, professional, suitable for card game, subtle and elegant, no text or numbers`;

  return generateImage({
    prompt: fullPrompt,
    size: '1024x1024',
    quality: 'hd',
    style: 'natural',
    model: 'dall-e-3',
  });
}

/**
 * Generate a card back design
 */
export async function generateCardBack(
  userPrompt: string
): Promise<GeneratedImage> {
  const fullPrompt = `Playing card back design: ${userPrompt}, centered symmetrical pattern, ornate, professional card design, portrait orientation 2:3 ratio, elegant border, no text, high quality casino-style`;

  return generateImage({
    prompt: fullPrompt,
    size: '1024x1536',
    quality: 'hd',
    style: 'vivid',
    model: 'dall-e-3',
  });
}

/**
 * Core image generation function
 */
async function generateImage(
  params: GenerateImageParams
): Promise<GeneratedImage> {
  try {
    const response = await fetch(API_BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: params.model || 'dall-e-3',
        prompt: params.prompt,
        n: 1,
        size: params.size || '1024x1024',
        quality: params.quality || 'standard',
        style: params.style || 'natural',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Image generation failed');
    }

    const data = await response.json();
    const imageData = data.data[0];

    return {
      url: imageData.url,
      revisedPrompt: imageData.revised_prompt,
    };
  } catch (error) {
    console.error('Image generation error:', error);
    throw error;
  }
}

/**
 * Download and save image to device
 * Returns local file path
 */
export async function downloadAndSaveImage(
  imageUrl: string,
  filename: string
): Promise<string> {
  try {
    // For React Native, you'd use react-native-fs or expo-file-system
    // This is a placeholder - implement based on your RN setup
    
    // Example with expo-file-system:
    // const FileSystem = require('expo-file-system');
    // const fileUri = FileSystem.documentDirectory + filename;
    // await FileSystem.downloadAsync(imageUrl, fileUri);
    // return fileUri;

    // For now, just return the URL
    return imageUrl;
  } catch (error) {
    console.error('Download error:', error);
    throw error;
  }
}
