/**
 * Game Piece Image Generation Service
 * Handles generation of custom chess and checkers pieces using OpenAI + background removal
 */

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || 'YOUR_API_KEY_HERE';
const REMOVE_BG_API_KEY = process.env.REMOVE_BG_API_KEY || ''; // Optional: get from https://remove.bg/api

const DALLE_API_URL = 'https://api.openai.com/v1/images/generations';
const REMOVE_BG_API_URL = 'https://api.remove.bg/v1.0/removebg';

export type GameType = 'chess' | 'checkers';
export type ChessPieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';
export type CheckersPieceType = 'regular' | 'king';
export type PieceColor = 'white' | 'black' | 'red';

export interface GeneratedPiece {
  type: string; // e.g. "white-king"
  url: string;
  transparentUrl?: string; // After background removal
}

export interface PieceGenerationProgress {
  current: number;
  total: number;
  currentPiece: string;
}

/**
 * Generate a single game piece with DALL-E
 */
async function generatePieceImage(
  gameType: GameType,
  pieceType: string,
  color: string,
  userPrompt: string
): Promise<string> {
  // Build context-aware prompt
  const contextPrompt = buildPiecePrompt(gameType, pieceType, color, userPrompt);

  const response = await fetch(DALLE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: contextPrompt,
      n: 1,
      size: '1024x1024',
      quality: 'standard',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Image generation failed');
  }

  const data = await response.json();
  return data.data[0].url;
}

/**
 * Remove background from image using remove.bg API
 * Falls back to original if API key not set
 */
async function removeBackground(imageUrl: string): Promise<string> {
  // If no API key, return original
  if (!REMOVE_BG_API_KEY) {
    console.warn('REMOVE_BG_API_KEY not set, skipping background removal');
    return imageUrl;
  }

  try {
    const formData = new FormData();
    formData.append('image_url', imageUrl);
    formData.append('size', 'auto');

    const response = await fetch(REMOVE_BG_API_URL, {
      method: 'POST',
      headers: {
        'X-Api-Key': REMOVE_BG_API_KEY,
      },
      body: formData,
    });

    if (!response.ok) {
      console.error('Background removal failed, using original image');
      return imageUrl;
    }

    // Convert blob to base64 data URL
    const blob = await response.blob();
    return await blobToDataURL(blob);
  } catch (error) {
    console.error('Background removal error:', error);
    return imageUrl; // Fallback to original
  }
}

/**
 * Convert Blob to data URL
 */
function blobToDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Build piece-specific prompt
 */
function buildPiecePrompt(
  gameType: GameType,
  pieceType: string,
  color: string,
  userPrompt: string
): string {
  const baseStyle = userPrompt.trim();
  
  if (gameType === 'chess') {
    const pieceDescriptions: Record<string, string> = {
      king: 'tallest piece with ornate crown and cross on top',
      queen: 'second tallest piece with graceful crown without cross',
      rook: 'castle tower shape with battlements on top',
      bishop: 'tall piece with pointed mitre top',
      knight: 'horse head in side profile',
      pawn: 'smallest piece with rounded top',
    };

    return `${baseStyle} style chess piece. ${color} ${pieceType}. ${pieceDescriptions[pieceType]}. Isolated object on solid white background (#FFFFFF). Front view, centered, professional quality 3D render. No shadows on background. Clean cutout suitable for transparency removal.`;
  } else {
    // Checkers
    const isKing = pieceType === 'king';
    const kingDesc = isKing ? 'with crown symbol on top surface' : '';
    
    return `${baseStyle} style checkers piece. ${color} circular disc ${kingDesc}. Top-down view. Isolated object on solid white background (#FFFFFF). Centered, professional quality. Glossy surface. No shadows on background. Clean cutout suitable for transparency removal.`;
  }
}

/**
 * Generate all chess pieces (12 total: 6 white + 6 black)
 */
export async function generateChessPieceSet(
  userPrompt: string,
  onProgress?: (progress: PieceGenerationProgress) => void
): Promise<GeneratedPiece[]> {
  const pieceTypes: ChessPieceType[] = ['king', 'queen', 'rook', 'bishop', 'knight', 'pawn'];
  const colors: PieceColor[] = ['white', 'black'];
  const pieces: GeneratedPiece[] = [];
  
  let current = 0;
  const total = pieceTypes.length * colors.length; // 12

  for (const color of colors) {
    for (const type of pieceTypes) {
      current++;
      const pieceKey = `${color}-${type}`;
      
      onProgress?.({ current, total, currentPiece: pieceKey });

      // 1. Generate with DALL-E
      const imageUrl = await generatePieceImage('chess', type, color, userPrompt);
      
      // 2. Remove background
      const transparentUrl = await removeBackground(imageUrl);

      pieces.push({
        type: pieceKey,
        url: imageUrl,
        transparentUrl,
      });

      // Rate limiting: wait 1s between requests
      if (current < total) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  return pieces;
}

/**
 * Generate all checkers pieces (4 total: 2 red + 2 black)
 */
export async function generateCheckersPieceSet(
  userPrompt: string,
  onProgress?: (progress: PieceGenerationProgress) => void
): Promise<GeneratedPiece[]> {
  const pieceTypes: CheckersPieceType[] = ['regular', 'king'];
  const colors: PieceColor[] = ['red', 'black'];
  const pieces: GeneratedPiece[] = [];
  
  let current = 0;
  const total = pieceTypes.length * colors.length; // 4

  for (const color of colors) {
    for (const type of pieceTypes) {
      current++;
      const pieceKey = `${color}-${type}`;
      
      onProgress?.({ current, total, currentPiece: pieceKey });

      // 1. Generate with DALL-E
      const imageUrl = await generatePieceImage('checkers', type, color, userPrompt);
      
      // 2. Remove background
      const transparentUrl = await removeBackground(imageUrl);

      pieces.push({
        type: pieceKey,
        url: imageUrl,
        transparentUrl,
      });

      // Rate limiting: wait 1s between requests
      if (current < total) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  return pieces;
}

/**
 * Generate game board background
 */
export async function generateGameBoard(
  gameType: GameType,
  userPrompt: string
): Promise<string> {
  const boardPrompt = gameType === 'chess'
    ? `${userPrompt} style chess board. Beautiful 8x8 grid with alternating light and dark squares. Viewed from directly above. Professional quality. Include coordinate labels a-h and 1-8 on edges. No pieces on board.`
    : `${userPrompt} style checkers board. Beautiful 8x8 grid with alternating light and dark squares. Viewed from directly above. Professional quality. No pieces on board.`;

  const response = await fetch(DALLE_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'dall-e-3',
      prompt: boardPrompt,
      n: 1,
      size: '1024x1024',
      quality: 'hd',
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Board generation failed');
  }

  const data = await response.json();
  return data.data[0].url;
}
