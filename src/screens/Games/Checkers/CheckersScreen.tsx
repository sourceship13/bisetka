import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, ImageBackground } from 'react-native';
import { BisetkaAlert } from '../../../utils/BisetkaAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import GameToolbar from '../../../components/global/GameToolbar';
import GameThemeCustomizer from '../../../components/global/GameThemeCustomizer';
import type { GameTheme } from '../../../components/global/GameThemeCustomizer';
import { aiMoveLogService } from '../../../services/aiMoveLog.service';
import { socketService } from '../../../services/SocketService';
import { v4 as uuidv4 } from 'uuid';
import { useGameEndRefresh } from '../../../libs/hooks/useGameEndRefresh';
import InGameChat from '../../../components/InGameChat';

type PieceType = 'regular' | 'king';
type PieceColor = 'red' | 'black';

interface Piece { color: PieceColor; type: PieceType; }
interface Position { row: number; col: number; }

interface GameState {
  board: (Piece | null)[][];
  currentPlayer: PieceColor;
  selectedSquare: Position | null;
  possibleMoves: Position[];
  isGameOver: boolean;
  winner: PieceColor | null;
}

// ─── pure helpers ────────────────────────────────────────────────────────────

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

function freshGame(): GameState {
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

function deserializeBoard(raw: any[][]): (Piece | null)[][] {
  return raw.map(row=>row.map(cell=>cell?{color:cell.color as PieceColor,type:cell.type as PieceType}:null));
}

// ─── component ───────────────────────────────────────────────────────────────

const CheckersScreen = ({ navigation, route }: any) => {
  const { session, mode } = route.params;
  // Stabilise userId for the lifetime of this component — never let it change between renders
  const userIdRef = useRef<string>(
    session?.user?.id || session?.id || ('guest-' + Math.random().toString(36).substr(2, 6))
  );
  const userId = userIdRef.current;
  const isMultiplayer = mode === 'random' || mode === 'private' || mode === 'private-create' || mode === 'private-join';

  const [gameState, setGameState] = useState<GameState>(freshGame());
  const gameIdRef   = useRef<string>(uuidv4());
  const moveCountRef = useRef(0);
  const lastPlayerMoveRef = useRef<{from:Position;to:Position;isJump?:boolean}|null>(null);
  useGameEndRefresh(gameState.isGameOver, 'checkers');

  // ── multiplayer state ──
  const [mpStatus, setMpStatus] = useState<'idle'|'connecting'|'searching'|'waiting'|'playing'|'ended'>('idle');
  const [roomId, setRoomId]     = useState<string|null>(null);
  const [roomCode, setRoomCode] = useState<string|null>(null);
  // server assigns 'white'|'black'; white→red pieces, black→black pieces
  const [mySocketColor, setMySocketColor] = useState<'white'|'black'|null>(null);
  const [serverTurn,    setServerTurn]    = useState<'white'|'black'>('white');
  const [statusMsg,     setStatusMsg]     = useState('');
  const [showCustomization, setShowCustomization] = useState(false);
  const [gameTheme, setGameTheme] = useState<GameTheme>({});

  const handleApplyTheme = (theme: GameTheme) => {
    setGameTheme(theme);
  };

  const myPieceColor: PieceColor = mySocketColor === 'black' ? 'black' : 'red';
  const isMyTurn = isMultiplayer ? serverTurn === mySocketColor : gameState.currentPlayer === 'red';

  // ── multiplayer setup ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isMultiplayer) return;
    let cancelled = false;
    setMpStatus('connecting');
    setStatusMsg('Connecting...');

    (async () => {
      try {
        await socketService.connect(userId, session?.access_token || 'temp-token');
        if (cancelled) return;

        const socket = socketService.getSocket();
        if (!socket) return;

        // clean slate
        ['match_found','room_joined','opponent_joined','game_started','move_made','game_ended','opponent_disconnected']
          .forEach(ev => socket.off(ev));

        let resolvedRoomId: string | null = null;

        socket.on('match_found', (data: any) => {
          if (cancelled) return;
          resolvedRoomId = data.roomId;
          setRoomId(data.roomId);
          setMySocketColor(data.color);
          setMpStatus('waiting');
          setStatusMsg('Waiting for game to start...');
          socket.emit('player_ready', { roomId: data.roomId, userId });
        });

        // Fires on the JOINER when they successfully enter a private room
        socket.on('room_joined', (data: any) => {
          if (cancelled) return;
          resolvedRoomId = data.roomId;
          setRoomId(data.roomId);
          setMySocketColor(data.color);
          setMpStatus('waiting');
          setStatusMsg('Waiting for game to start...');
          // Joiner sends ready immediately — creator sends ready on opponent_joined
          socket.emit('player_ready', { roomId: data.roomId, userId });
        });

        // Fires on the CREATOR when player 2 joins the room
        socket.on('opponent_joined', () => {
          if (cancelled) return;
          setStatusMsg('Opponent joined! Starting...');
          if (resolvedRoomId) socket.emit('player_ready', { roomId: resolvedRoomId, userId });
        });

        socket.on('game_started', (data: any) => {
          if (cancelled) return;
          setGameState({
            board: data.gameState?.board ? deserializeBoard(data.gameState.board) : initializeBoard(),
            currentPlayer: 'red', selectedSquare: null, possibleMoves: [], isGameOver: false, winner: null,
          });
          setServerTurn(data.gameState?.currentTurn ?? 'white');
          setMpStatus('playing');
        });

        socket.on('move_made', (data: any) => {
          if (cancelled) return;
          if (data.gameState?.board) {
            setGameState(prev => ({
              ...prev,
              board: deserializeBoard(data.gameState.board),
              selectedSquare: null,
              possibleMoves: [],
            }));
          }
          setServerTurn(data.currentTurn ?? 'white');
        });

        socket.on('game_ended', (data: any) => {
          if (cancelled) return;
          const iWon = data.winnerId === userId;
          const myC = mySocketColor === 'black' ? 'black' : 'red';
          setGameState(prev => ({
            ...prev,
            board: data.gameState?.board ? deserializeBoard(data.gameState.board) : prev.board,
            isGameOver: true,
            winner: iWon ? myC as PieceColor : (myC === 'red' ? 'black' : 'red') as PieceColor,
          }));
          setMpStatus('ended');
        });

        socket.on('opponent_disconnected', () => {
          if (cancelled) return;
          BisetkaAlert.success('Opponent disconnected', 'You win by forfeit!');
          setGameState(prev => ({ ...prev, isGameOver: true, winner: mySocketColor === 'black' ? 'black' : 'red' }));
          setMpStatus('ended');
        });

        // ── start the right flow depending on mode ──────────────────────────
        if (mode === 'random') {
          setStatusMsg('Finding opponent...');
          setMpStatus('searching');
          socket.emit('find_match', { gameType: 'checkers', userId });
        } else if (mode === 'private-create') {
          setStatusMsg('Creating room...');
          setMpStatus('searching');
          try {
            const joinCode = session?.code;
            const roomData = await socketService.createPrivateRoom('checkers', userId, joinCode);
            if (!cancelled) {
              resolvedRoomId = roomData.roomId;
              setRoomId(roomData.roomId);
              setRoomCode(roomData.roomCode);
              setMySocketColor('white');
              setMpStatus('waiting');
              setStatusMsg(`Room created! Code: ${roomData.roomCode}`);
            }
          } catch (err: any) {
            if (!cancelled) {
              BisetkaAlert.error('Error', 'Failed to create room');
              setMpStatus('idle');
              navigation.goBack();
            }
          }
        } else if (mode === 'private-join') {
          const joinCode = session?.code;
          if (!joinCode) {
            BisetkaAlert.error('Error', 'No room code provided');
            setMpStatus('idle');
            navigation.goBack();
            return;
          }
          setStatusMsg('Joining room...');
          setMpStatus('searching');
          socket.emit('join_private_room', { roomCode: joinCode, userId });
        }
      } catch (err) {
        if (!cancelled) { setMpStatus('idle'); setStatusMsg('Connection failed. Please try again.'); }
      }
    })();

    return () => {
      cancelled = true;
      const socket = socketService.getSocket();
      if (socket) {
        ['match_found','room_joined','opponent_joined','game_started','move_made','game_ended','opponent_disconnected']
          .forEach(ev => socket.off(ev));
        if (mode === 'random') socket.emit('cancel_matchmaking', { userId });
      }
    };
  }, []);

  // ── AI turn ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (isMultiplayer || mode !== 'ai') return;
    if (gameState.currentPlayer !== 'black' || gameState.isGameOver) return;
    const timer = setTimeout(() => {
      const moves: {from:Position;to:Position}[] = [];
      for (let r=0;r<8;r++) for (let c=0;c<8;c++) {
        const p = gameState.board[r][c];
        if (p && p.color==='black')
          getPossibleMoves(gameState.board,{row:r,col:c}).forEach(m=>moves.push({from:{row:r,col:c},to:m}));
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
  }, [gameState.currentPlayer, gameState.isGameOver]);

  // ── board tap ─────────────────────────────────────────────────────────────
  const handleSquarePress = useCallback((dRow: number, dCol: number) => {
    // flip board visually for black player so their pieces are at the bottom
    const row = myPieceColor === 'black' ? 7-dRow : dRow;
    const col = myPieceColor === 'black' ? 7-dCol : dCol;

    if (gameState.isGameOver) return;
    if (isMultiplayer && (mpStatus !== 'playing' || !isMyTurn)) return;
    if (mode === 'ai' && gameState.currentPlayer === 'black') return;

    const activeColor: PieceColor = isMultiplayer ? myPieceColor : gameState.currentPlayer;
    const piece = gameState.board[row]?.[col];

    if (!gameState.selectedSquare) {
      if (piece && piece.color === activeColor) {
        setGameState(prev => ({ ...prev, selectedSquare:{row,col}, possibleMoves: getPossibleMoves(prev.board,{row,col}) }));
      }
      return;
    }

    const sel = gameState.selectedSquare;
    const isValid = gameState.possibleMoves.some(m=>m.row===row&&m.col===col);

    if (isValid) {
      if (isMultiplayer && roomId) {
        // Optimistic: apply locally, server confirms via move_made
        setGameState(prev => ({ ...prev, board: applyMove(prev.board,sel,{row,col}), selectedSquare:null, possibleMoves:[] }));
        socketService.makeMove(roomId, userId, { from: sel, to: {row,col} });
      } else {
        if (mode==='ai') lastPlayerMoveRef.current = { from:sel, to:{row,col} };
        const nb = applyMove(gameState.board, sel, {row,col});
        const next: PieceColor = gameState.currentPlayer==='red'?'black':'red';
        const hasLeft = hasAnyMoves(nb, next);
        const winner: PieceColor|null = !hasLeft ? gameState.currentPlayer : null;
        if (!hasLeft) BisetkaAlert.success('Game Over!', `${gameState.currentPlayer==='red'?'Red':'Black'} wins!`);
        setGameState(prev => ({ ...prev, board:nb, currentPlayer:next, selectedSquare:null, possibleMoves:[], isGameOver:!hasLeft, winner }));
      }
    } else if (piece && piece.color === activeColor) {
      setGameState(prev => ({ ...prev, selectedSquare:{row,col}, possibleMoves: getPossibleMoves(prev.board,{row,col}) }));
    } else {
      setGameState(prev => ({ ...prev, selectedSquare:null, possibleMoves:[] }));
    }
  }, [gameState, isMyTurn, myPieceColor, mpStatus, roomId, isMultiplayer, mode, userId]);

  // ── matchmaking / waiting screen ──────────────────────────────────────────
  if (isMultiplayer && (mpStatus==='connecting'||mpStatus==='searching'||mpStatus==='waiting')) {
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
              {mode === 'private-create' && roomCode ? (
                // ── Room created — show shareable code ──────────────────────
                <>
                  <Text style={styles.roomCreatedTitle}>Room Created! 🎮</Text>
                  <Text style={styles.roomCodeLabel}>Share this code with your friend:</Text>
                  <View style={styles.roomCodeBox}>
                    <Text style={styles.roomCodeValue}>{roomCode}</Text>
                  </View>
                  <Text style={styles.searchingText}>Waiting for opponent to join...</Text>
                  <ActivityIndicator size="small" color="#3498db" style={{marginTop: 8}} />
                </>
              ) : (
                // ── Spinner for random / joining ────────────────────────────
                <>
                  <ActivityIndicator size="large" color="#3498db" />
                  <Text style={styles.searchingText}>{statusMsg}</Text>
                </>
              )}
              <TouchableOpacity style={styles.cancelButton} onPress={() => {
                const socket = socketService.getSocket();
                socket?.emit('cancel_matchmaking', { userId });
                navigation.goBack();
              }}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </SafeAreaView>
        </LinearGradient>
      </ImageBackground>
    );
  }

  // ── turn label ────────────────────────────────────────────────────────────
  const turnLabel = isMultiplayer
    ? isMyTurn ? `Your Turn (${myPieceColor==='red'?'🔴 Red':'⚫ Black'})` : "Opponent's Turn..."
    : gameState.currentPlayer==='red' ? 'Your Turn (Red)' : mode==='ai' ? "AI's Turn (Black)" : "Black's Turn";

  // ── board render ──────────────────────────────────────────────────────────
  return (
    <ImageBackground
      source={require('../../../../assets/blot/park-background.png')}
      style={styles.container}
      blurRadius={3}>
      <LinearGradient
        colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.5)']}
        style={styles.overlay}>
        <SafeAreaView style={styles.safeArea}>
          <GameToolbar
            title={isMultiplayer ? 'Checkers (Online)' : mode==='ai' ? 'Checkers (vs AI)' : 'Checkers'}
            onBack={() => {
              if (isMultiplayer && roomId) socketService.resign(roomId, userId);
              navigation.goBack();
            }}
            backgroundColor="transparent"
            rightElement={
              <TouchableOpacity
                onPress={() => setShowCustomization(true)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={{ fontSize: 20 }}>🎨</Text>
              </TouchableOpacity>
            }
          />

      <View style={styles.statusBar}>
        <Text style={styles.turnText}>{turnLabel}</Text>
        {isMultiplayer && mySocketColor && (
          <Text style={styles.colorBadge}>
            You: {myPieceColor==='red'?'🔴 Red':'⚫ Black'}  •  Opponent: {myPieceColor==='red'?'⚫ Black':'🔴 Red'}
          </Text>
        )}
      </View>

      <View style={styles.boardContainer}>
        <ImageBackground
          source={require('../../../../assets/chess/board.png')}
          style={styles.board}
          resizeMode="stretch"
        >
          <View style={styles.gridContainer}>
          {Array(8).fill(null).map((_,dRow) => {
            const logRow = myPieceColor==='black' ? 7-dRow : dRow;
            return (
              <View key={dRow} style={styles.row}>
                {Array(8).fill(null).map((_,dCol) => {
                  const logCol = myPieceColor==='black' ? 7-dCol : dCol;
                  const piece = gameState.board[logRow]?.[logCol] ?? null;
                  const isLight = (dRow+dCol)%2===0;
                  const isSel = gameState.selectedSquare?.row===logRow && gameState.selectedSquare?.col===logCol;
                  const isPoss = gameState.possibleMoves.some(m=>m.row===logRow&&m.col===logCol);
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

      {gameState.isGameOver && (
        <View style={styles.gameOverOverlay}>
          <View style={styles.gameOverBox}>
            <Text style={styles.gameOverTitle}>Game Over!</Text>
            <Text style={styles.gameOverText}>
              {isMultiplayer
                ? gameState.winner===myPieceColor ? 'You Win! 🎉' : 'You Lose!'
                : gameState.winner==='red' ? 'Red Wins! 🎉' : 'Black Wins!'}
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

      {/* In-game chat overlay (multiplayer only) */}
      <InGameChat
        roomId={roomId || ''}
        currentUserId={userId}
        gameType="checkers"
        visible={isMultiplayer && !!roomId}
      />
    </ImageBackground>
  );
};

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
  lightSquare:        { backgroundColor:'transparent' },
  darkSquare:         { backgroundColor:'transparent' },
  selectedSquare:     { backgroundColor:'rgba(130, 151, 105, 0.6)' },
  possibleMoveSquare: { backgroundColor:'rgba(100, 111, 64, 0.5)' },
  piece:              { width:'70%', height:'70%', borderRadius:100, justifyContent:'center', alignItems:'center', borderWidth:2, borderColor:'#000' },
  redPiece:           { backgroundColor:'#e74c3c' },
  blackPiece:         { backgroundColor:'#2c3e50' },
  kingPiece:          { borderColor:'#f39c12', borderWidth:3 },
  kingText:           { fontSize:24, color:'#f39c12' },
  moveIndicator:      { width:12, height:12, borderRadius:6, backgroundColor:'rgba(255,255,255,0.6)' },
  gameOverOverlay:    { ...StyleSheet.absoluteFillObject, backgroundColor:'rgba(0,0,0,0.7)', justifyContent:'center', alignItems:'center' },
  gameOverBox:        { backgroundColor:'#fff', padding:30, borderRadius:10, alignItems:'center', minWidth:250 },
  gameOverTitle:      { fontSize:24, fontWeight:'bold', marginBottom:10, color:'#2c3e50' },
  gameOverText:       { fontSize:18, marginBottom:20, color:'#34495e' },
  playAgainButton:    { backgroundColor:'#3498db', paddingHorizontal:24, paddingVertical:12, borderRadius:8 },
  playAgainText:      { color:'#fff', fontSize:16, fontWeight:'600' },
});

export default CheckersScreen;
