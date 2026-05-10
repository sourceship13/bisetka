import React, {useState, useEffect, useRef, useMemo} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Alert, Animated, ScrollView, Image, useWindowDimensions} from 'react-native';
import { BisetkaAlert } from '../../../utils/BisetkaAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import AraratBackground from '../../../components/AraratBackground';
import AR3DOverlay, {type AR3DOverlayHandle, type ARPiece} from '../../../components/AR3DOverlay';
import ReAnimated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import ExpandableView from '../../../components/global/ExpandableView';
import GameToolbar from '../../../components/global/GameToolbar';
import GameToolbarControls from '../../../components/global/GameToolbarControls';
import {
  Difficulty,
  ChessGameState,
  initializeChessGame,
  getPossibleMoves,
  makeMove,
  isKingInCheck,
  isCheckmate,
  getDrawReason,
  getComputerMove,
  Position,
} from '../../../game/chessLogic';
import GameThemeCustomizer from '../../../components/global/GameThemeCustomizer';
import type { GameTheme } from '../../../components/global/GameThemeCustomizer';
import { aiMoveLogService } from '../../../services/aiMoveLog.service';
import { playPieceMoveSound } from '../../../utils/nardiSound';
import { v4 as uuidv4 } from 'uuid';
import { useGameEndRefresh } from '../../../libs/hooks/useGameEndRefresh';
import { apiService } from '../../../services/api.service';
import { useAuth } from '../../../libs/hooks/useAuth';
import { useAchievements } from '../../../contexts/AchievementContext';
import SyncedYouTubePlayer from '../../../components/SyncedYouTubePlayer';
import InGameChat from '../../../components/InGameChat';
import { resolveAvatar } from '../../../utils/avatars';

const PANO_SOURCE = require('../../../../assets/backgrounds/capture360/pano2.jpg');

const CHESS_SYMBOLS: Record<string, Record<string, string>> = {
  white: { king: '♔', queen: '♕', rook: '♖', bishop: '♗', knight: '♘', pawn: '♙' },
  black: { king: '♚', queen: '♛', rook: '♜', bishop: '♝', knight: '♞', pawn: '♟' },
};

const CHESS_BOARD_CONFIGS = [
  { label: 'ChessSet', path: 'glb/chess/ChessSet.glb', embeddedPieces: true },
  { label: 'Classic',  path: 'glb/checkers/chess_board_v2.glb', embeddedPieces: false },
  { label: 'Armenian', path: 'glb/game_boards/armenian_marble_gold_merged.glb', embeddedPieces: false },
];

const ChessScreen = ({navigation}: any) => {
  const { width, height } = useWindowDimensions();
  const boardSize = Math.min(width, height - 200);
  const squareSize = boardSize / 8;
  const { user, refreshUser } = useAuth();
  const { showAchievements } = useAchievements();
  const [difficulty, setDifficulty] = useState<Difficulty | null>(null);
  const [gameState, setGameState] = useState<ChessGameState | null>(null);
  const gameIdRef = useRef<string | null>(null);
  const moveCountRef = useRef(0);
  const lastPlayerMoveRef = useRef<{ from: Position; to: Position; piece: string; captured?: string } | null>(null);
  useGameEndRefresh(!!(gameState?.isCheckmate || gameState?.isStalemate), 'chess');
  const [showCustomization, setShowCustomization] = useState(false);
  const [showBlur, setShowBlur] = useState(false);
  const [showMusicPlayer, setShowMusicPlayer] = useState(false);
  const [arEnabled, setArEnabled] = useState(true);
  const [boardIdx, setBoardIdx] = useState(0);
  const boardConfigs = CHESS_BOARD_CONFIGS;
  const arOverlayRef = useRef<AR3DOverlayHandle>(null);

  // ── Chess AR pieces ──────────────────────────────────────────────────────
  const arPieces = useMemo<ARPiece[]>(() => {
    if (!gameState) return [];
    const result: ARPiece[] = [];
    gameState.board.forEach((row, r) => {
      row.forEach((piece, c) => {
        if (!piece) return;
        result.push({
          key: `${r}-${c}`,
          row: r,
          col: c,
          color: piece.color === 'white' ? 'red' : 'black',
          isKing: piece.type === 'king',
          pieceType: piece.type as ARPiece['pieceType'],
          side: piece.color as 'white' | 'black',
          isSelected:
            gameState.selectedSquare?.row === r &&
            gameState.selectedSquare?.col === c,
        });
      });
    });
    return result;
  }, [gameState?.board, gameState?.selectedSquare]);

  const [gameTheme, setGameTheme] = useState<GameTheme>({});
  const toolbarExpanded = useSharedValue(false);
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: withTiming(toolbarExpanded.value ? '180deg' : '0deg', { duration: 250 }) }],
  }));
  const [showPanel, setShowPanel] = useState(false);
  const panelAnim = useRef(new Animated.Value(0)).current;

  const togglePanel = () => {
    const toValue = showPanel ? 0 : 1;
    setShowPanel(!showPanel);
    Animated.spring(panelAnim, {
      toValue, useNativeDriver: true, speed: 20, bounciness: 4,
    }).start();
  };

  const toggleLeave = () => {
    BisetkaAlert.alert('Leave Game', 'Are you sure you want to leave the game?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Leave', style: 'destructive', onPress: () => navigation.goBack() },
    ]);
  };

  // Entry fee and prize tracking
  const [entryDeducted, setEntryDeducted] = useState(false);
  const [prizeAwarded, setPrizeAwarded] = useState(false);
  const [userPoints, setUserPoints] = useState(Math.floor(user?.balance || 0));

  // Debug: Log user state on mount
  useEffect(() => {
    console.log('🎮 ChessScreen mounted');
    console.log('   User:', user ? { id: user.id, points: user.points } : 'NOT LOGGED IN');
  }, []);

  const handleApplyTheme = (theme: GameTheme) => {
    setGameTheme(theme);
  };

  // Entry fee deduction handler
  const handleGameStart = async () => {
    if (entryDeducted) {
      console.log('⚠️ Entry already deducted, skipping');
      return;
    }

    if (!user?.id) {
      console.error('❌ User not authenticated');
      Alert.alert(
        'Not Logged In',
        'You must be logged in to play. Please sign in and try again.',
        [
          {
            text: 'OK',
            onPress: () => {
              resetGame();
              navigation.goBack();
            },
          },
        ]
      );
      return;
    }

    try {
      console.log('💰 Deducting chess entry fee...');
      console.log('   User ID:', user.id);
      console.log('   Game ID:', gameIdRef.current);
      
      const result = await apiService.deductEntry('chess', gameIdRef.current || undefined);
      
      console.log('📥 Entry result:', JSON.stringify(result));
      
      if (result.success) {
        console.log(`✅ Entry deducted: -50 points. New balance: ${result.newBalance}`);
        setUserPoints(result.newBalance);
        setEntryDeducted(true);
        
        // Refresh user data in Auth context
        refreshUser().catch(err => console.error('Failed to refresh user after entry:', err));
      } else {
        console.error('❌ Insufficient points:', result.error);
        Alert.alert(
          'Insufficient Points',
          result.error || 'You need 50 points to play chess.',
          [
            {
              text: 'OK',
              onPress: () => {
                resetGame();
                navigation.goBack();
              },
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('❌ Entry deduction error:', error);
      console.error('   Error message:', error?.message);
      console.error('   Error status:', error?.status);
      console.error('   Error code:', error?.code);
      console.error('   Full error:', JSON.stringify(error));
      
      Alert.alert(
        'Error',
        `Failed to deduct entry fee: ${error?.message || 'Please try again.'}`,
        [
          {
            text: 'OK',
            onPress: () => {
              resetGame();
              navigation.goBack();
            },
          },
        ]
      );
    }
  };

  // Prize award handler
  const handleGameEnd = async (winner: 'white' | 'black' | null) => {
    if (prizeAwarded || !user?.id) return;

    try {
      // Determine result: white = player, black = computer
      const result: 'win' | 'draw' | 'loss' = 
        winner === null ? 'draw' : 
        winner === 'white' ? 'win' : 
        'loss';
      
      console.log(`🏆 Awarding prize and logging game for ${result}...`);
      
      const prizeResult = await apiService.awardPrizeAndLog(
        'chess',
        result,
        'ai', // Chess is always AI mode
        {
          gameId: gameIdRef.current,
          playerScore: result === 'win' ? 1 : 0,
        }
      );
      
      if (prizeResult.success) {
        console.log(`✅ ${prizeResult.message}`);
        setUserPoints(prizeResult.newBalance);
        setPrizeAwarded(true);
        
        // Show unlocked achievements
        if (prizeResult.unlockedAchievements && prizeResult.unlockedAchievements.length > 0) {
          console.log('🏆 Unlocked achievements:', prizeResult.unlockedAchievements);
          showAchievements(prizeResult.unlockedAchievements);
        }
        
        // Refresh user data in Auth context (so HomeScreen sees updated balance)
        refreshUser().catch(err => console.error('Failed to refresh user after game:', err));
        
        // Show prize notification after game over screen
        if (result === 'win') {
          setTimeout(() => {
            Alert.alert(
              '🏆 Victory!',
              `You won ${prizeResult.prize} points!\n\nNew balance: ${prizeResult.newBalance} points`,
              [{ text: 'Awesome!', style: 'default' }]
            );
          }, 2000);
        } else if (result === 'draw') {
          setTimeout(() => {
            Alert.alert(
              'Draw',
              `Entry fee refunded: ${prizeResult.prize} points\n\nNew balance: ${prizeResult.newBalance} points`,
              [{ text: 'OK', style: 'default' }]
            );
          }, 2000);
        }
        // For loss, we don't show an alert (they already know they lost)
      }
    } catch (error: any) {
      console.error('❌ Prize award error:', error);
      // Non-fatal - game is over, just log it
    }
  };

  // Deduct entry fee when game starts
  useEffect(() => {
    if (gameState && difficulty && !entryDeducted) {
      handleGameStart();
    }
  }, [gameState, difficulty, entryDeducted]);

  // Award prize when game ends
  useEffect(() => {
    if (gameState && (gameState.isCheckmate || gameState.isStalemate) && !prizeAwarded) {
      // Determine winner: if checkmate and currentPlayer is black, white (player) won
      // if currentPlayer is white, black (computer) won
      let winner: 'white' | 'black' | null = null;
      if (gameState.isCheckmate) {
        winner = gameState.currentPlayer === 'black' ? 'white' : 'black';
      } else {
        winner = null; // stalemate = draw
      }
      handleGameEnd(winner);
    }
  }, [gameState?.isCheckmate, gameState?.isStalemate, prizeAwarded]);

  useEffect(() => {
    // Computer's turn
    if (gameState && gameState.currentPlayer === 'black' && !gameState.isCheckmate && !gameState.isStalemate) {
      const boardBefore = gameState.board;
      const timer = setTimeout(() => {
        // Get computer move using current gameState
        const computerMove = getComputerMove(gameState.board, gameState.difficulty, 'black');
        if (computerMove) {
          const aiPiece = gameState.board[computerMove.from.row][computerMove.from.col];
          const capturedPiece = gameState.board[computerMove.to.row][computerMove.to.col];
          
          // Execute move using functional update to avoid stale state
          setGameState(prevState => {
            if (!prevState) return prevState;
            
            const newBoard = makeMove(prevState.board, { from: computerMove.from, to: computerMove.to });
            playPieceMoveSound();
            const nextPlayer = 'white';

            const isCheck = isKingInCheck(newBoard, nextPlayer);
            const isCheckMate = isCheckmate(newBoard, nextPlayer);
            const drawReason = getDrawReason(newBoard, nextPlayer);
            const isStaleMate = drawReason !== null;

            // Log AI move after state update
            if (gameIdRef.current && lastPlayerMoveRef.current) {
              moveCountRef.current++;
              aiMoveLogService.logChessMove({
                gameId: gameIdRef.current,
                moveNumber: moveCountRef.current,
                playerMove: lastPlayerMoveRef.current,
                aiMove: {
                  from: computerMove.from,
                  to: computerMove.to,
                  piece: aiPiece?.type || 'unknown',
                  captured: capturedPiece?.type,
                },
                boardStateBefore: boardBefore,
                boardStateAfter: newBoard,
                difficulty: prevState.difficulty,
                isCheck,
                isCheckmate: isCheckMate,
              });
              lastPlayerMoveRef.current = null;
            }

            return {
              ...prevState,
              board: newBoard,
              currentPlayer: nextPlayer,
              selectedSquare: null,
              possibleMoves: [],
              isCheck,
              isCheckmate: isCheckMate,
              isStalemate: isStaleMate,
              drawReason,
            };
          });
        }
      // Slow down AI so the player can clearly see which piece moved (1800-2500ms)
      }, 1800 + Math.floor(Math.random() * 700));
      return () => clearTimeout(timer);
    }
  }, [gameState]);

  const startGame = (selectedDifficulty: Difficulty) => {
    setDifficulty(selectedDifficulty);
    setGameState(initializeChessGame(selectedDifficulty));
    gameIdRef.current = uuidv4();
    moveCountRef.current = 0;
    lastPlayerMoveRef.current = null;
  };

  const handleSquarePress = (row: number, col: number) => {
    if (!gameState || gameState.currentPlayer !== 'white' || gameState.isCheckmate || gameState.isStalemate) return;

    const position: Position = { row, col };
    const piece = gameState.board[row][col];

    // If no square selected and clicked on own piece
    if (!gameState.selectedSquare && piece && piece.color === 'white') {
      const moves = getPossibleMoves(gameState.board, position);
      setGameState({
        ...gameState,
        selectedSquare: position,
        possibleMoves: moves,
      });
      return;
    }

    // If square already selected
    if (gameState.selectedSquare) {
      // Check if this is a valid move
      const isValidMove = gameState.possibleMoves.some(
        m => m.row === row && m.col === col
      );

      if (isValidMove) {
        executeMove(gameState.selectedSquare, position);
      } else if (piece && piece.color === 'white') {
        // Select different piece
        const moves = getPossibleMoves(gameState.board, position);
        setGameState({
          ...gameState,
          selectedSquare: position,
          possibleMoves: moves,
        });
      } else {
        // Deselect
        setGameState({
          ...gameState,
          selectedSquare: null,
          possibleMoves: [],
        });
      }
    }
  };

  const executeMove = (from: Position, to: Position) => {
    if (!gameState) return;

    // Capture player move info for AI logging
    const playerPiece = gameState.board[from.row][from.col];
    const capturedPiece = gameState.board[to.row][to.col];
    lastPlayerMoveRef.current = {
      from,
      to,
      piece: playerPiece?.type || 'unknown',
      captured: capturedPiece?.type,
    };

    const newBoard = makeMove(gameState.board, { from, to });
    playPieceMoveSound();
    const nextPlayer = gameState.currentPlayer === 'white' ? 'black' : 'white';

    const isCheck = isKingInCheck(newBoard, nextPlayer);
    const isCheckMate = isCheckmate(newBoard, nextPlayer);
    const drawReason = getDrawReason(newBoard, nextPlayer);
    const isStaleMate = drawReason !== null;

    setGameState({
      ...gameState,
      board: newBoard,
      currentPlayer: nextPlayer,
      selectedSquare: null,
      possibleMoves: [],
      isCheck,
      isCheckmate: isCheckMate,
      isStalemate: isStaleMate,
      drawReason,
      moveHistory: [...gameState.moveHistory, { from, to }],
    });

    if (isCheckMate) {
      BisetkaAlert.success('Checkmate!', `${gameState.currentPlayer === 'white' ? 'White' : 'Black'} wins!`);
    } else if (isStaleMate) {
      BisetkaAlert.alert(
        drawReason === 'insufficient-material' ? 'Draw!' : 'Stalemate!',
        drawReason === 'insufficient-material' ? 'Only the two kings remain. The game is a draw.' : 'Game is a draw.'
      );
    } else if (isCheck) {
      BisetkaAlert.warning('Check!', `${nextPlayer === 'white' ? 'White' : 'Black'} is in check.`);
    }
  };

  const resetGame = () => {
    setDifficulty(null);
    setGameState(null);
    gameIdRef.current = null;
    moveCountRef.current = 0;
    lastPlayerMoveRef.current = null;
    setEntryDeducted(false);
    setPrizeAwarded(false);
  };

  // Difficulty selection screen
  if (!difficulty || !gameState) {
    return (
      <View style={styles.container}>
        <AraratBackground overlayOpacity={0.5} />
          <SafeAreaView style={styles.safeArea}>
            <GameToolbar title="Chess" onBack={() => navigation.goBack()} backgroundColor="transparent" />

            <View style={styles.difficultySelection}>
          <Text style={styles.difficultyTitle}>Select Difficulty</Text>

          <TouchableOpacity
            style={[styles.difficultyButton, styles.easyButton]}
            onPress={() => startGame('easy')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.difficultyButtonTitle}>Easy</Text>
            <Text style={styles.difficultyButtonDescription}>
              Computer makes random moves
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.difficultyButton, styles.mediumButton]}
            onPress={() => startGame('medium')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.difficultyButtonTitle}>Medium</Text>
            <Text style={styles.difficultyButtonDescription}>
              Computer prefers captures
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.difficultyButton, styles.hardButton]}
            onPress={() => startGame('hard')}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.difficultyButtonTitle}>Hard</Text>
            <Text style={styles.difficultyButtonDescription}>
              Computer evaluates best moves
            </Text>
          </TouchableOpacity>
        </View>
          </SafeAreaView>
      </View>
    );
  }

  // Game screen
  return (
    <View style={styles.container}>
      {/* Photosphere always renders — AR3DOverlay WebView is transparent and sits on top */}
      <AraratBackground overlayOpacity={0.4} />
      <AR3DOverlay
        ref={arOverlayRef}
        visible={arEnabled}
        pieces={arPieces}
        moves={gameState?.possibleMoves}
        onSquareTap={handleSquarePress}
        boardGlbPath={boardConfigs[boardIdx].path}
        boardGlbHasEmbeddedChessPieces={!!boardConfigs[boardIdx].embeddedPieces}
        hideCheckerboard={true}
        boardFixed
        boardFixedZoom={0.6}
        boardTiltX={0}
        boardY={-0.35}
        tableDist={0.50}
        boardScale={0.8}
        chessPieceGlbPaths={boardConfigs[boardIdx].embeddedPieces ? undefined : {
          white_pawn:   'glb/chess/pawn.glb',
          white_rook:   'glb/chess/rook.glb',
          white_knight: 'glb/chess/knight.glb',
          white_bishop: 'glb/chess/bishop.glb',
          white_queen:  'glb/chess/queen.glb',
          white_king:   'glb/chess/king.glb',
          black_pawn:   'glb/chess/pawn.glb',
          black_rook:   'glb/chess/rook.glb',
          black_knight: 'glb/chess/knight.glb',
          black_bishop: 'glb/chess/bishop.glb',
          black_queen:  'glb/chess/queen.glb',
          black_king:   'glb/chess/king.glb',
        }}
      />
      <View style={styles.overlay} pointerEvents="box-none">
        <SafeAreaView style={styles.safeArea} pointerEvents="box-none">
          <View>
            <GameToolbar
              title={`Chess - ${difficulty}`}
              onBack={resetGame}
              backgroundColor="transparent"
            />
            <View>
               <GameToolbarControls
                buttons={[
                  { icon: '🎨', onPress: () => setShowCustomization(true) },
                  { icon: arEnabled ? '🥽' : '🎮', onPress: () => setArEnabled(!arEnabled) },
                  { icon: '🔄', onPress: () => setBoardIdx(i => (i + 1) % boardConfigs.length) },
                  { icon: showMusicPlayer ? '🎵' : '🎶', onPress: () => setShowMusicPlayer(s => !s) },
                  { icon: '👥', onPress: togglePanel },
                  { icon: '🚪', onPress: toggleLeave },
                ]}
              />
            </View>
          </View>

      <View style={styles.statusBar}>
        <Text style={styles.turnText}>
          {gameState.currentPlayer === 'white' ? "Your Turn (White)" : "Computer's Turn (Black)"}
        </Text>
        {gameState.isCheck && <Text style={styles.checkText}>CHECK!</Text>}
      </View>

      {!arEnabled && (
        <View style={styles.boardContainer}>
          <View style={{ width: boardSize, height: boardSize, borderWidth: 2, borderColor: '#5d3a1a' }}>
            {gameState.board.map((row, r) => (
              <View key={r} style={{ flexDirection: 'row' }}>
                {row.map((piece, c) => {
                  const isDark = (r + c) % 2 === 1;
                  const isSelected = gameState.selectedSquare?.row === r && gameState.selectedSquare?.col === c;
                  const isPossible = gameState.possibleMoves.some(m => m.row === r && m.col === c);
                  return (
                    <TouchableOpacity
                      key={c}
                      style={[
                        { width: squareSize, height: squareSize, justifyContent: 'center', alignItems: 'center' },
                        { backgroundColor: isDark ? '#b58863' : '#f0d9b5' },
                        isSelected ? { backgroundColor: 'rgba(127,166,80,0.95)' } : null,
                        isPossible ? { backgroundColor: isDark ? 'rgba(127,166,80,0.75)' : 'rgba(127,166,80,0.55)' } : null,
                      ]}
                      onPress={() => handleSquarePress(r, c)}
                      activeOpacity={0.8}
                    >
                      {piece && (
                        <Text style={{ fontSize: squareSize * 0.68, lineHeight: squareSize, textAlign: 'center', includeFontPadding: false }}>
                          {CHESS_SYMBOLS[piece.color]?.[piece.type] ?? '?'}
                        </Text>
                      )}
                      {isPossible && !piece && (
                        <View style={{ width: squareSize * 0.3, height: squareSize * 0.3, borderRadius: squareSize * 0.15, backgroundColor: 'rgba(0,0,0,0.25)' }} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        </View>
      )}

      {(gameState.isCheckmate || gameState.isStalemate) && (
        <View style={styles.gameOverOverlay}>
          <View style={styles.gameOverBox}>
            <Text style={styles.gameOverTitle}>
              {gameState.isCheckmate ? 'Checkmate!' : gameState.drawReason === 'insufficient-material' ? 'Draw!' : 'Stalemate!'}
            </Text>
            <Text style={styles.gameOverText}>
              {gameState.isCheckmate
                ? gameState.currentPlayer === 'black' ? 'You Win!' : 'Computer Wins!'
                : gameState.drawReason === 'insufficient-material'
                  ? 'Only kings remain. This is a draw.'
                  : "It's a Draw!"}
            </Text>
            <TouchableOpacity
              style={styles.playAgainButton}
              onPress={() => {
                navigation.replace('GameInfo', {
                  gameType: 'chess',
                  preferredMode: 'ai',
                });
              }}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.playAgainText}>Play Again</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Player Panel */}
      {showPanel && (
        <TouchableOpacity
          style={styles.panelBackdrop}
          activeOpacity={1}
          onPress={togglePanel}
        />
      )}
      <Animated.View
        style={[
          styles.sidePanel,
          {
            transform: [{
              translateX: panelAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [280, 0],
              }),
            }],
          },
        ]}
        pointerEvents={showPanel ? 'auto' : 'none'}
      >
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Players</Text>
          <TouchableOpacity onPress={togglePanel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.panelClose}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={styles.panelContent}>
          <Text style={styles.panelSectionTitle}>🎮 In Game</Text>

          {/* Player (White) */}
          <View style={[styles.panelPlayerRow, gameState.currentPlayer === 'white' && styles.panelPlayerRowActive]}>
            <View style={styles.panelAvatarClip}>
              {resolveAvatar(user?.avatar_url ?? null) ? (
                <Image source={resolveAvatar(user?.avatar_url ?? null)!} style={styles.panelAvatar} />
              ) : (
                <View style={styles.panelAvatarPlaceholder}>
                  <Text style={styles.panelAvatarInitials}>
                    {(user?.username || 'Y')[0].toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            {gameState.currentPlayer === 'white' && <View style={styles.panelTurnDot} />}
            <View style={styles.panelPlayerInfo}>
              <Text style={styles.panelPlayerName}>{user?.username || 'You'}</Text>
              <View style={[styles.panelTeamBadge, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
                <Text style={styles.panelTeamText}>♔ White</Text>
              </View>
            </View>
          </View>

          {/* Computer (Black) */}
          <View style={[styles.panelPlayerRow, gameState.currentPlayer === 'black' && styles.panelPlayerRowActive]}>
            <View style={styles.panelAvatarClip}>
              <View style={styles.panelAvatarPlaceholder}>
                <Text style={styles.panelAvatarInitials}>🤖</Text>
              </View>
            </View>
            {gameState.currentPlayer === 'black' && <View style={styles.panelTurnDot} />}
            <View style={styles.panelPlayerInfo}>
              <Text style={styles.panelPlayerName}>Computer ({difficulty})</Text>
              <View style={[styles.panelTeamBadge, { backgroundColor: 'rgba(0,0,0,0.4)' }]}>
                <Text style={styles.panelTeamText}>♚ Black</Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </Animated.View>
        </SafeAreaView>
      </View>

      <GameThemeCustomizer
        visible={showCustomization}
        onClose={() => setShowCustomization(false)}
        onApply={handleApplyTheme}
        gameType="chess"
        initialTheme={gameTheme}
      />
      <InGameChat
        roomId={''}
        currentUserId={user?.id ?? ''}
        gameType="chess"
        visible={true}
      />
      <SyncedYouTubePlayer roomId={null} visible={true} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  newGameText: {
    fontSize: 16,
    color: '#FFD700',
    fontWeight: '600',
  },
  customizeText: {
    fontSize: 20,
  },
  difficultySelection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  difficultyTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFD700',
    marginBottom: 32,
  },
  difficultyButton: {
    borderRadius: 12,
    padding: 24,
    marginBottom: 16,
    width: '100%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  easyButton: {
    backgroundColor: '#22C55E',
  },
  mediumButton: {
    backgroundColor: '#F59E0B',
  },
  hardButton: {
    backgroundColor: '#EF4444',
  },
  difficultyButtonTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  difficultyButtonDescription: {
    fontSize: 14,
    color: '#fff',
    opacity: 0.9,
  },
  statusBar: {
    backgroundColor: '#1C1917',
    padding: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#FFD700',
  },
  turnText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  checkText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#EF4444',
    marginTop: 4,
  },
  boardContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  board: {
    aspectRatio: 1,
    // Width and height set dynamically via inline style
  },
  gridContainer: {
    flex: 1,
    paddingTop: 40,
    paddingBottom: 55,
    paddingHorizontal: 52,
  },
  row: {
    flex: 1,
    flexDirection: 'row',
  },
  square: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  lightSquare: {
    backgroundColor: 'transparent',
  },
  darkSquare: {
    backgroundColor: 'transparent',
  },
  selectedSquare: {
    backgroundColor: 'rgba(127, 166, 80, 0.6)',
  },
  possibleMoveSquare: {
    backgroundColor: 'rgba(127, 166, 80, 0.4)',
  },
  moveIndicator: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  gameOverOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  gameOverBox: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  gameOverTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#1C1917',
    marginBottom: 16,
  },
  gameOverText: {
    fontSize: 20,
    color: '#312E2B',
    marginBottom: 24,
  },
  playAgainButton: {
    backgroundColor: '#FFD700',
    borderRadius: 8,
    padding: 12,
    paddingHorizontal: 32,
  },
  playAgainText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1C1917',
  },
  panelBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sidePanel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 270,
    backgroundColor: 'rgba(12,12,30,0.97)',
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.12)',
    shadowColor: '#000',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 20,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 56,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  panelTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  panelClose: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.6)',
    fontWeight: '600',
  },
  panelContent: {
    flex: 1,
    padding: 14,
  },
  panelSectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.5)',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
    marginTop: 6,
  },
  panelPlayerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    marginBottom: 4,
  },
  panelPlayerRowActive: {
    backgroundColor: 'rgba(255,215,0,0.10)',
  },
  panelAvatarClip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
    marginRight: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  panelAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
  },
  panelAvatarPlaceholder: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.13)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  panelAvatarInitials: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
  },
  panelTurnDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFD700',
    marginRight: 6,
  },
  panelPlayerInfo: {
    flex: 1,
  },
  panelPlayerName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  panelTeamBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  panelTeamText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  recenterBtn: { position:'absolute', bottom:200, alignSelf:'center', left:'50%', transform:[{translateX:-54}], flexDirection:'row', alignItems:'center', gap:6, backgroundColor:'rgba(0,0,0,0.35)', borderWidth:1, borderColor:'rgba(255,255,255,0.25)', borderRadius:24, paddingHorizontal:18, paddingVertical:10 },
  recenterIcon: { fontSize:20, color:'#fff' },
  recenterLabel: { fontSize:13, color:'#fff', fontWeight:'600', letterSpacing:0.3 },
});

export default ChessScreen;
