// ========================================
// EASY MODE + DRAG-AND-DROP IMPLEMENTATION
// ========================================
// Instructions: Apply these changes to NardiScreen.tsx

// ─── 1. ADD IMPORT (Line ~10) ───
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageBackground,
  Image,
  Dimensions,
  ActivityIndicator,
  Alert,
  PanResponder, // ← ADD THIS
} from 'react-native';

// ─── 2. ADD STATE VARIABLES (Line ~121) ───
const [easyMode, setEasyMode] = useState(false); // ← ADD: Easy Mode toggle (false = drag mode, true = tap mode)
const [draggedFrom, setDraggedFrom] = useState<number | null>(null); // ← ADD: Track drag source
const [dragPosition, setDragPosition] = useState<{ x: number; y: number } | null>(null); // ← ADD: Track drag position

// ─── 3. UPDATE TOOLBAR BUTTONS (Line ~982) ───
<GameToolbarControls
  buttons={[
    { icon: showBlur ? '🌫️' : '✨', onPress: () => setShowBlur(!showBlur) },
    { icon: showBackground ? '🖼️' : '🔲', onPress: () => setShowBackground(!showBackground) },
    { icon: easyMode ? '🎮' : '🎯', onPress: () => setEasyMode(!easyMode), label: easyMode ? 'Easy Mode' : 'Normal Mode' }, // ← ADD THIS LINE
    ...(isMultiplayer && mpStatus === 'playing' ? [{ icon: '✏️', onPress: () => setShowRoomNameModal(true) }] : []),
  ]}
/>

// ─── 4. REPLACE renderPoint FUNCTION (Line ~850) ───
const renderPoint = (pointNum: number) => {
  if (!gameState) return null;
  
  // Convert 1-based point number to 0-based array index
  const pointIndex = pointNum - 1;
  const point = gameState.points[pointIndex];
  const checkers = point.checkers.length;
  const pos = getPointCoords(pointNum);
  
  // Get color from the top checker (last in array) if any
  const color = checkers > 0 ? point.checkers[point.checkers.length - 1] : null;
  const isSelected = selectedPoint === pointIndex;
  const myColorForRender = isMultiplayer ? myMpColorRef.current : 'white';

  // Check if this is a valid destination when a piece is selected (including bar entry when selectedPoint === -1)
  const isValidDestination = selectedPoint !== null && 
    gameState.possibleMoves.some(m => m.from === selectedPoint && m.to === pointIndex);
  
  // Also highlight as valid destination for bar entry even before bar is "selected"
  const isBarEntryDest = gameState.bar[gameState.currentPlayer] > 0 &&
    gameState.currentPlayer === myColorForRender &&
    gameState.possibleMoves.some(m => m.from === -1 && m.to === pointIndex);
  
  // Check if this piece can be moved (has any valid moves)
  const canMove = checkers > 0 &&
    gameState.phase === 'moving' &&
    gameState.currentPlayer === myColorForRender &&
    point.checkers[point.checkers.length - 1] === myColorForRender &&
    gameState.possibleMoves.some(m => m.from === pointIndex);

  const maxVisible = 5;
  const stackGap = CHECKER_SIZE * 0.35; // Slight overlap
  const visibleCheckers = Math.min(checkers, maxVisible);

  // ────────────────────────────────────────────────────────────
  // DRAG-AND-DROP PAN RESPONDER (Normal Mode)
  // ────────────────────────────────────────────────────────────
  const panResponder = !easyMode && canMove ? PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    
    onPanResponderGrant: (evt) => {
      console.log('🎯 Drag started from point:', pointNum);
      setDraggedFrom(pointIndex);
      setDragPosition({ x: evt.nativeEvent.pageX, y: evt.nativeEvent.pageY });
    },
    
    onPanResponderMove: (evt) => {
      setDragPosition({ x: evt.nativeEvent.pageX, y: evt.nativeEvent.pageY });
    },
    
    onPanResponderRelease: (evt) => {
      console.log('🎯 Drag released at:', evt.nativeEvent.pageX, evt.nativeEvent.pageY);
      
      // Find which point the user dropped on
      const dropX = evt.nativeEvent.pageX;
      const dropY = evt.nativeEvent.pageY;
      
      // Check all points to see which one we dropped on
      let droppedOnPoint = -1;
      let minDistance = CHECKER_SIZE * 1.5; // Tolerance radius
      
      for (let i = 1; i <= 24; i++) {
        const targetPos = getPointCoords(i);
        const distance = Math.sqrt(
          Math.pow(dropX - targetPos.x, 2) + 
          Math.pow(dropY - targetPos.y, 2)
        );
        if (distance < minDistance) {
          minDistance = distance;
          droppedOnPoint = i - 1; // Convert to 0-based index
        }
      }
      
      // Check if dropped on borne-off tray
      // White tray: top-left, Black tray: bottom-left
      // (You may need to adjust these coordinates based on your layout)
      
      if (droppedOnPoint !== -1 && draggedFrom !== null) {
        const move = gameState.possibleMoves.find(
          m => m.from === draggedFrom && m.to === droppedOnPoint
        );
        if (move) {
          console.log('✅ Valid drop, executing move:', move);
          handleMove(move);
        } else {
          console.log('❌ Invalid drop location - no valid move found');
          BisetkaAlert.error('Invalid Move', 'You cannot move there based on your dice roll');
        }
      }
      
      setDraggedFrom(null);
      setDragPosition(null);
    },
    
    onPanResponderTerminate: () => {
      setDraggedFrom(null);
      setDragPosition(null);
    },
  }) : undefined;

  // ────────────────────────────────────────────────────────────
  // RENDER STACK
  // ────────────────────────────────────────────────────────────
  const stackContent = (
    <>
      {checkers > 0 && Array.from({ length: visibleCheckers }).map((_, i) => {
        // When the stack is truncated show the top N checkers; otherwise index directly.
        const checkerIndex = checkers > maxVisible
          ? (checkers - visibleCheckers) + i
          : i;
        const individualColor = (point.checkers[checkerIndex] ?? color) as 'white' | 'black';
        return (
          <View key={i} style={{ marginTop: i > 0 ? -stackGap : 0 }}>
            {renderChecker(individualColor, i)}
          </View>
        );
      })}
      {checkers > maxVisible && (
        <View style={styles.checkerCount}>
          <Text style={styles.checkerCountText}>{checkers}</Text>
        </View>
      )}
      {checkers === 0 && (isValidDestination || isBarEntryDest) && (
        <View style={styles.emptyDestinationMarker}>
          <Text style={styles.emptyDestinationText}>✓</Text>
        </View>
      )}
    </>
  );

  return (
    <View
      key={pointNum}
      {...(panResponder ? panResponder.panHandlers : {})}
      style={[
        styles.pointStack,
        {
          left: pos.x - CHECKER_SIZE / 2,
          width: CHECKER_SIZE,
          ...(pos.isTop
            ? { top: pos.y, minHeight: CHECKER_SIZE * 1.5 }
            : { top: pos.y - TRIANGLE_HEIGHT, height: TRIANGLE_HEIGHT, justifyContent: 'flex-end' as const }),
        },
        isSelected && styles.pointSelected,
        (isValidDestination || isBarEntryDest) && styles.validDestination,
        canMove && styles.canMove,
        draggedFrom === pointIndex && { opacity: 0.5 }, // Dim the source during drag
      ]}>
      {easyMode ? (
        // ═══════════════════════════════════════════════
        // EASY MODE: TAP-TO-MOVE (Original behavior)
        // ═══════════════════════════════════════════════
        <TouchableOpacity
          onPress={() => {
            console.log('🖱️ TouchableOpacity pressed for point:', pointNum, '(index:', pointIndex, ')');
            handlePointPress(pointIndex);
          }}
          activeOpacity={0.8}
          style={{ flex: 1, width: '100%' }}>
          {stackContent}
        </TouchableOpacity>
      ) : (
        // ═══════════════════════════════════════════════
        // NORMAL MODE: DRAG-AND-DROP (New behavior)
        // ═══════════════════════════════════════════════
        stackContent
      )}
    </View>
  );
};

// ─── 5. ADD FLOATING DRAGGED CHECKER (Add before closing </SafeAreaView>) ───
{/* Floating dragged checker visual feedback */}
{!easyMode && dragPosition && draggedFrom !== null && gameState && (
  <View
    style={{
      position: 'absolute',
      left: dragPosition.x - CHECKER_SIZE / 2,
      top: dragPosition.y - CHECKER_SIZE / 2,
      zIndex: 9999,
      pointerEvents: 'none',
    }}>
    <Image
      source={
        gameState.points[draggedFrom]?.checkers[gameState.points[draggedFrom].checkers.length - 1] === 'white'
          ? require('../../../../assets/nardi/checker-white.png')
          : require('../../../../assets/nardi/checker-black.png')
      }
      style={[styles.checker, { opacity: 0.8 }]}
    />
  </View>
)}

// ═══════════════════════════════════════════════════════════
// SUMMARY OF BEHAVIOR:
// ═══════════════════════════════════════════════════════════
// 
// EASY MODE (🎮 Toggle ON):
// - Tap a checker to select it (highlights valid destinations)
// - Tap a highlighted destination to complete the move
// - Same as original click-to-move behavior
// 
// NORMAL MODE (🎯 Toggle OFF) [DEFAULT]:
// - Press and hold on a checker to start dragging
// - Drag the checker across the board
// - Drop on a valid destination point to complete move
// - Invalid drops show error alert
// - Only allows moves permitted by dice rolls
// - Game rules fully enforced (same as Easy Mode)
// 
// ═══════════════════════════════════════════════════════════
