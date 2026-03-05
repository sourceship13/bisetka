/**
 * REFACTORED: Checkers Screen with AI Mode Support
 * 
 * This screen supports both AI mode (local gameplay) and multiplayer mode.
 * Multiplayer boilerplate is eliminated using useMultiplayerGame hook.
 * AI logic is preserved unchanged.
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ImageBackground } from 'react-native';
import { BisetkaAlert } from '../../../utils/BisetkaAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import GameToolbar from '../../../components/global/GameToolbar';
import RoomNameModal from '../../../components/RoomNameModal';
import GameThemeCustomizer from '../../../components/global/GameThemeCustomizer';
import type { GameTheme } from '../../../components/global/GameThemeCustomizer';
import { aiMoveLogService } from '../../../services/aiMoveLog.service';
import { v4 as uuidv4 } from 'uuid';
import { useGameEndRefresh } from '../../../libs/hooks/useGameEndRefresh';
import InGameChat from '../../../components/InGameChat';

// ═══ NEW: Single import for multiplayer ═══
import { useMultiplayerGame, useMatchmakingUI, checkersAdapter } from '../../../multiplayer';
import type { CheckersGameState, CheckersMove } from '../../../multiplayer/adapters/CheckersGameAdapter';

type PieceType = 'regular' | 'king';
type PieceColor = 'red' | 'black';

interface Piece { color: PieceColor; type: PieceType; }
interface Position { row: number; col: number; }

// ─── Pure game logic helpers (unchanged) ─────────────────────────────────────

function initializeBoard(): (Piece | null)[][] {
  const b: (Piece | null)[][] = Array(8).fill(null).map(() => Array(8).fill(null));
  for (let r = 0; r < 3; r++)
    for (let c = 0; c < 8; c++)
      if ((r + c) % 2 === 1) b[r][c] = { color: 'black', type: 'regular' };
  for (let r = 5; r < 8; r++)
    for (let c = 0; c < 8; c++)
      if ((r + c) % 2 === 1) b[r][c] = { color: 'red', type: 'regular' };
  return b;
}

function freshGame(): CheckersGameState {
  return { board: initializeBoard(), currentPlayer: 'red', selectedSquare: null, possibleMoves: [], isGameOver: false, winner: null };
}

function getPossibleMoves(board: (Piece | null)[][], pos: Position): Position[] {
  const piece = board[pos.row][pos.col];
  if (!piece) return [];
  const dirs = piece.type === 'king'
    ? [[-1,-1],[-1,1],[1,-1],[1,1]]
    : piece.color === 'red' ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]];
  const moves: Position[] = [];
  for (const [dr, dc] of dirs) {
    const nr = pos.row+dr, nc = pos.col+dc;
    if (nr<0||nr>7||nc<0||nc>7) continue;
    if (!board[nr][nc]) { moves.push({row:nr,col:nc}); }
    else if (board[nr][nc]!.color !== piece.color) {
      const jr=nr+dr, jc=nc+dc;
      if (jr>=0&&jr<8&&jc>=0&&jc<8&&!board[jr][jc]) moves.push({row:jr,col:jc});
    }
  }
  return moves;
}

function hasAnyMoves(board: (Piece | null)[][], color: PieceColor): boolean {
  for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
    const p = board[r][c];
    if (p && p.color===color && getPossibleMoves(board,{row:r,col:c}).length>0) return true;
  }
  return false;
}

function applyMove(board: (Piece | null)[][], from: Position, to: Position): (Piece | null)[][] {
  const nb = board.map(row=>[...row]);
  const piece = nb[from.row][from.col];
  if (!piece) return nb;
  nb[to.row][to.col] = piece;
  nb[from.row][from.col] = null;
  if (Math.abs(to.row-from.row)===2) nb[(from.row+to.row)/2][(from.col+to.col)/2]=null;
  if (piece.color==='red'   && to.row===0) nb[to.row][to.col]={color:'red',  type:'king'};
  if (piece.color==='black' && to.row===7) nb[to.row][to.col]={color:'black',type:'king'};
  return nb;
}

// ─────────────────────────────────────────────────────────────────────────────

const CheckersScreenRefactored = ({ navigation, route }: any) => {
  const { session, mode } = route.params;
  const userIdRef = useRef<string>(
    session?.user?.id || session?.id || ('guest-' + Math.random().toString(36).substr(2, 6))
  );
  const userId = userIdRef.current;
  const isMultiplayer = mode === 'random' || mode === 'private' || mode === 'private-create' || mode === 'private-join';

  const [gameState, setGameState] = useState<CheckersGameState>(freshGame());
  const gameIdRef = useRef<string>(uuidv4());
  const moveCountRef = useRef(0);
  const lastPlayerMoveRef = useRef<{from:Position;to:Position;isJump?:boolean}|null>(null);
  useGameEndRefresh(gameState.isGameOver, 'checkers');

  const [showCustomization, setShowCustomization] = useState(false);
  const [gameTheme, setGameTheme] = useState<GameTheme>({});
  const [roomName, setRoomName] = useState('Multiplayer Checkers');
  const [showRoomNameModal, setShowRoomNameModal] = useState(false);

  // ═══════════════════════════════════════════════════════════════════════════
  // 🎯 MULTIPLAYER HOOK - Only used when isMultiplayer = true
  // ═══════════════════════════════════════════════════════════════════════════
  
  const mpHook = useMultiplayerGame<CheckersGameState, CheckersMove>({
    gameType: 'checkers',
    userId,
    mode: isMultiplayer ? (mode === 'random' ? 'random' : mode === 'private-create' ? 'private-create' : 'private-join') : 'random',
    joinCode: session?.code,
    adapter: checkersAdapter,
    autoConnect: isMultiplayer,
    autoStart: isMultiplayer,
    
    onGameStart: (data) => {
      setGameState(data.gameState || freshGame());
    },
    
    onMoveMade: (data) => {
      setGameState(data.gameState);
    },
    
    onGameEnd: (result) => {
      const didIWin = result.winnerId === userId;
      BisetkaAlert.success(
        'Game Over',
        didIWin ? 'You win! 🎉' : 'Opponent wins',
        [{text: 'OK', onPress: () => navigation.replace('GameMode', {gameType: 'checkers'})}]
      );
    },
    
    onOpponentDisconnected: () => {
      BisetkaAlert.warning(
        'Opponent Disconnected',
        'Your opponent has disconnected.',
        [{text: 'OK', onPress: () => navigation.replace('GameMode', {gameType: 'checkers'})}]
      );
    },
  });

  const { showMatchmaking, showWaitingRoom, showGame: mpShowGame } = useMatchmakingUI(mpHook.status);

  // Determine effective values
  const myPieceColor: PieceColor = isMultiplayer 
    ? (mpHook.myPlayer?.color === 'black' ? 'black' : 'red')
    : 'red';
  const isMyTurn = isMultiplayer ? mpHook.isMyTurn : gameState.currentPlayer === 'red';
  const effectiveGameState = isMultiplayer ? (mpHook.gameState || gameState) : gameState;

  const handleApplyTheme = (theme: GameTheme) => {
    setGameTheme(theme);
  };

  // ─── AI turn (only in AI mode) ───────────────────────────────────────────
  useEffect(() => {
    if (isMultiplayer || mode !== 'ai') return;
    if (effectiveGameState.currentPlayer !== 'black' || effectiveGameState.isGameOver) return;
    const timer = setTimeout(() => {
      const moves: {from:Position;to:Position}[] = [];
      for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
        const p = effectiveGameState.board[r][c];
        if (p && p.color==='black')
          getPossibleMoves(effectiveGameState.board,{row:r,col:c}).forEach(m=>moves.push({from:{row:r,col:c},to:m}));
      }
      if (!moves.length) return;
      const mv = moves[Math.floor(Math.random()*moves.length)];
      setGameState(prev => {
        const nb = applyMove(prev.board, mv.from, mv.to);
        const hasLeft = hasAnyMoves(nb,'red');
        if (lastPlayerMoveRef.current) {
          moveCountRef.current++;
          aiMoveLogService.logCheckersMove({
            gameId: gameIdRef.current, moveNumber: moveCountRef.current,
            playerMove: lastPlayerMoveRef.current,
            aiMove: { from: mv.from, to: mv.to, isJump: Math.abs(mv.to.row-mv.from.row)===2 },
            boardStateBefore: prev.board, boardStateAfter: nb,
            playerPiecesRemaining: nb.flat().filter(p=>p?.color==='red').length,
            aiPiecesRemaining:     nb.flat().filter(p=>p?.color==='black').length,
            wasKingMove: prev.board[mv.from.row][mv.from.col]?.type==='king',
          });
          lastPlayerMoveRef.current = null;
        }
        if (!hasLeft) setTimeout(()=>BisetkaAlert.success('Game Over!','Black wins!'),100);
        return { ...prev, board:nb, currentPlayer:'red', selectedSquare:null, possibleMoves:[], isGameOver:!hasLeft, winner:!hasLeft?'black':null };
      });
    }, 500);
    return () => clearTimeout(timer);
  }, [effectiveGameState.currentPlayer, effectiveGameState.isGameOver, isMultiplayer, mode]);

  // ─── Board tap ────────────────────────────────────────────────────────────
  const handleSquarePress = useCallback((dRow: number, dCol: number) => {
    const row = myPieceColor === 'black' ? 7-dRow : dRow;
    const col = myPieceColor === 'black' ? 7-dCol : dCol;

    if (effectiveGameState.isGameOver) return;
    if (isMultiplayer && (!mpShowGame || !isMyTurn)) return;
    if (mode === 'ai' && effectiveGameState.currentPlayer === 'black') return;

    const activeColor: PieceColor = isMultiplayer ? myPieceColor : effectiveGameState.currentPlayer;
    const piece = effectiveGameState.board[row]?.[col];

    if (!effectiveGameState.selectedSquare) {
      if (piece && piece.color === activeColor) {
        setGameState(prev => ({ ...prev, selectedSquare:{row,col}, possibleMoves: getPossibleMoves(prev.board,{row,col}) }));
      }
      return;
    }

    const sel = effectiveGameState.selectedSquare;
    const isValid = effectiveGameState.possibleMoves.some(m=>m.row===row&&m.col===col);

    if (isValid) {
      if (isMultiplayer && mpHook.room) {
        setGameState(prev => ({ ...prev, board: applyMove(prev.board,sel,{row,col}), selectedSquare:null, possibleMoves:[] }));
        mpHook.makeMove({ from: sel, to: {row,col} });
      } else {
        if (mode==='ai') lastPlayerMoveRef.current = { from:sel, to:{row,col} };
        const nb = applyMove(effectiveGameState.board, sel, {row,col});
        const next: PieceColor = effectiveGameState.currentPlayer==='red'?'black':'red';
        const hasLeft = hasAnyMoves(nb, next);
        const winner: PieceColor|null = !hasLeft ? effectiveGameState.currentPlayer : null;
        if (!hasLeft) BisetkaAlert.success('Game Over!', `${effectiveGameState.currentPlayer==='red'?'Red':'Black'} wins!`);
        setGameState(prev => ({ ...prev, board:nb, currentPlayer:next, selectedSquare:null, possibleMoves:[], isGameOver:!hasLeft, winner }));
      }
    } else if (piece && piece.color === activeColor) {
      setGameState(prev => ({ ...prev, selectedSquare:{row,col}, possibleMoves: getPossibleMoves(prev.board,{row,col}) }));
    } else {
      setGameState(prev => ({ ...prev, selectedSquare:null, possibleMoves:[] }));
    }
  }, [effectiveGameState, isMyTurn, myPieceColor, mpShowGame, mpHook.room, isMultiplayer, mode, userId]);

  // ─── Matchmaking / waiting screen ─────────────────────────────────────────
  if (isMultiplayer && (showMatchmaking || showWaitingRoom)) {
    return (
      <ImageBackground
        source={require('../../../../assets/blot/park-background.png')}
        style={styles.container}
        blurRadius={3}>
        <LinearGradient
          colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)']}
          style={styles.overlay}>
          <SafeAreaView style={styles.safeArea}>
            <GameToolbar title="Checkers" onBack={() => { navigation.goBack(); }} backgroundColor="transparent" />
            <View style={styles.centeredContent}>
              {mpHook.room?.code ? (
                <>
                  <Text style={styles.roomCreatedTitle}>Room Created! 🎮</Text>
                  <Text style={styles.roomCodeLabel}>Share this code with your friend:</Text>
                  <View style={styles.roomCodeBox}>
                    <Text style={styles.roomCodeValue}>{mpHook.room.code}</Text>
                  </View>
                  <Text style={styles.searchingText}>Waiting for opponent to join...</Text>
                  <ActivityIndicator size="small" color="#3498db" style={{marginTop: 8}} />
                </>
              ) : (
                <>
                  <ActivityIndicator size="large" color="#3498db" />
                  <Text style={styles.searchingText}>
                    {showMatchmaking ? 'Finding opponent...' : 'Waiting for game to start...'}
                  </Text>
                </>
              )}
              <TouchableOpacity style={styles.cancelButton} onPress={() => {
                mpHook.cancelMatchmaking();
                navigation.goBack();
              }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>

          <RoomNameModal
            visible={showRoomNameModal}
            onClose={() => setShowRoomNameModal(false)}
            currentName={roomName}
            onSave={(newName) => {
              setRoomName(newName);
              mpHook.setRoomName(newName);
            }}
            gameType="Checkers"
          />
        </LinearGradient>
      </ImageBackground>
    );
  }

  // ─── Turn label ───────────────────────────────────────────────────────────
  const turnLabel = isMultiplayer
    ? isMyTurn ? `Your Turn (${myPieceColor==='red'?'🔴 Red':'⚫ Black'})` : "Opponent's Turn..."
    : effectiveGameState.currentPlayer==='red' ? 'Your Turn (Red)' : mode==='ai' ? "AI's Turn (Black)" : "Black's Turn";

  // ─── Main game board ──────────────────────────────────────────────────────
  return (
    <ImageBackground
      source={require('../../../../assets/blot/park-background.png')}
      style={styles.container}
      blurRadius={3}>
      <LinearGradient
        colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)')}
        style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>
          <GameToolbar
            title={isMultiplayer ? 'Checkers (Online)' : mode==='ai' ? 'Checkers (vs AI)' : 'Checkers'}
            onBack={() => {
              if (isMultiplayer && mpHook.room) mpHook.resign();
              navigation.goBack();
            }}
            backgroundColor="transparent"
            rightElement={
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {isMultiplayer && mpShowGame && (
                  <TouchableOpacity
                    onPress={() => setShowRoomNameModal(true)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    style={{ padding: 8, borderRadius: 8, backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
                    <Text style={{ fontSize: 18 }}>✏️</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  onPress={() => setShowCustomization(true)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Text style={{ fontSize: 20 }}>🎨</Text>
                </TouchableOpacity>
              </View>
            }
          />

          <View style={styles.statusBar}>
            <Text style={styles.turnText}>{turnLabel}</Text>
            {isMultiplayer && mpHook.myPlayer && (
              <Text style={styles.colorBadge}>
                You: {myPieceColor==='red'?'🔴 Red':'⚫ Black'}  •  Opponent: {myPieceColor==='red'?'⚫ Black':'🔴 Red'}
              </Text>
            )}
          </View>

          <View style={styles.boardContainer}>
            <ImageBackground
              source={require('../../../../assets/chess/board.png')}
              style={styles.board}
              resizeMode="stretch">
              <View style={styles.gridContainer}>
                {Array(8).fill(null).map((_,dRow) => {
                  const logRow = myPieceColor==='black' ? 7-dRow : dRow;
                  return (
                    <View key={dRow} style={styles.row}>
                      {Array(8).fill(null).map((_,dCol) => {
                        const logCol = myPieceColor==='black' ? 7-dCol : dCol;
                        const piece = effectiveGameState.board[logRow]?.[logCol] ?? null;
                        const isSel = effectiveGameState.selectedSquare?.row===logRow && effectiveGameState.selectedSquare?.col===logCol;
                        const isPoss = effectiveGameState.possibleMoves.some(m=>m.row===logRow&&m.col===logCol);
                        return (
                          <TouchableOpacity
                            key={`${dRow}-${dCol}`}
                            style={[
                              styles.square,
                              isSel && styles.selectedSquare,
                              isPoss && styles.possibleMoveSquare,
                            ]}
                            onPress={() => handleSquarePress(dRow, dCol)}
                            hitSlop={{top:2,bottom:2,left:2,right:2}}>
                            {piece && (
                              <View style={[styles.piece, piece.color==='red' ? styles.redPiece : styles.blackPiece, piece.type==='king' && styles.kingPiece]}>
                                {piece.type==='king' && <Text style={styles.kingText}>♔</Text>}
                              </View>
                            )}
                            {isPoss && !piece && <View style={styles.moveIndicator} />}
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            </ImageBackground>
          </View>

          {effectiveGameState.isGameOver && (
            <View style={styles.gameOverOverlay}>
              <View style={styles.gameOverBox}>
                <Text style={styles.gameOverTitle}>Game Over!</Text>
                <Text style={styles.gameOverText}>
                  {isMultiplayer
                    ? effectiveGameState.winner===myPieceColor ? 'You Win! 🎉' : 'You Lose!'
                    : effectiveGameState.winner==='red' ? 'Red Wins! 🎉' : 'Black Wins!'}
                </Text>
                {!isMultiplayer && (
                  <TouchableOpacity style={styles.playAgainButton} onPress={() => { setGameState(freshGame()); gameIdRef.current=uuidv4(); moveCountRef.current=0; }}>
                    <Text style={styles.playAgainText}>Play Again</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={[styles.playAgainButton,{backgroundColor:'#7f8c8d',marginTop:8}]} onPress={()=>navigation.goBack()}>
                  <Text style={styles.playAgainText}>Back to Menu</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </SafeAreaView>
      </LinearGradient>

      <GameThemeCustomizer
        visible={showCustomization}
        onClose={() => setShowCustomization(false)}
        onApply={handleApplyTheme}
        gameType="checkers"
        initialTheme={gameTheme}
      />

      <InGameChat
        roomId={mpHook.room?.id || ''}
        currentUserId={userId}
        gameType="checkers"
        visible={isMultiplayer && !!mpHook.room?.id}
      />
    </ImageBackground>
  );
};

// ═══════════════════════════════════════════════════════════════════════════
// STYLES (Unchanged)
// ═══════════════════════════════════════════════════════════════════════════

const styles = StyleSheet.create({
  container:          { flex:1 },
  overlay:            { flex:1 },
  safeArea:           { flex:1 },
  centeredContent:    { flex:1, justifyContent:'center', alignItems:'center', gap:20, padding:20 },
  searchingText:      { color:'#ecf0f1', fontSize:18, textAlign:'center', marginTop:16 },
  cancelButton:       { marginTop:20, paddingHorizontal:32, paddingVertical:12, backgroundColor:'#e74c3c', borderRadius:8 },
  cancelText:         { color:'#fff', fontSize:16, fontWeight:'600' },
  roomCreatedTitle:   { color:'#ffffff', fontSize:24, fontWeight:'bold', textAlign:'center', marginBottom:8 },
  roomCodeLabel:      { color:'#bdc3c7', fontSize:15, textAlign:'center', marginBottom:12 },
  roomCodeBox:        { backgroundColor:'rgba(255,255,255,0.15)', borderRadius:12, paddingHorizontal:32, paddingVertical:16, marginBottom:8 },
  roomCodeValue:      { color:'#ffffff', fontSize:42, fontWeight:'bold', letterSpacing:6, textAlign:'center' },
  statusBar:          { alignItems:'center', paddingVertical:10, backgroundColor:'#34495e', paddingHorizontal:10 },
  turnText:           { fontSize:16, fontWeight:'600', color:'#ecf0f1' },
  colorBadge:         { fontSize:13, color:'#bdc3c7', marginTop:2 },
  boardContainer:     { flex:1, justifyContent:'center', alignItems:'center', padding:20 },
  board:              { width:'100%', maxWidth:500, aspectRatio:1 },
  gridContainer:      { flex:1, paddingTop:40, paddingBottom:55, paddingHorizontal:50 },
  row:                { flex:1, flexDirection:'row' },
  square:             { flex:1, justifyContent:'center', alignItems:'center', backgroundColor:'transparent' },
  selectedSquare:     { backgroundColor:'rgba(130, 151, 105, 0.6)' },
  possibleMoveSquare: { backgroundColor:'rgba(100, 111, 64, 0.5)' },
  piece:              { width:'70%', height:'70%', borderRadius:100, justifyContent:'center', alignItems:'center', borderWidth:2, borderColor:'#000' },
  redPiece:           { backgroundColor:'#e74c3c' },
  blackPiece:         { backgroundColor:'#2c3e50' },
  kingPiece:          { borderColor:'#f39c12', borderWidth:3 },
  kingText:           { fontSize:24, color:'#f39c12' },
  moveIndicator:      { width:12, height:12, borderRadius:6, backgroundColor:'rgba(255,255,255,0.6)' },
  gameOverOverlay:    { ...StyleSheet.absoluteFillObject as any, backgroundColor:'rgba(0,0,0,0.7)', justifyContent:'center', alignItems:'center' },
  gameOverBox:        { backgroundColor:'#fff', padding:30, borderRadius:10, alignItems:'center', minWidth:250 },
  gameOverTitle:      { fontSize:24, fontWeight:'bold', marginBottom:10, color:'#2c3e50' },
  gameOverText:       { fontSize:18, marginBottom:20, color:'#34495e' },
  playAgainButton:    { backgroundColor:'#3498db', paddingHorizontal:24, paddingVertical:12, borderRadius:8 },
  playAgainText:      { color:'#fff', fontSize:16, fontWeight:'600' },
});

export default CheckersScreenRefactored;
