import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {PieceType, PieceColor} from '../game/chessLogic';

interface ChessPieceProps {
  type: PieceType;
  color: PieceColor;
}

const ChessPiece: React.FC<ChessPieceProps> = ({type, color}) => {
  const pieceSymbols = {
    white: {
      king: '♔',
      queen: '♕',
      rook: '♖',
      bishop: '♗',
      knight: '♘',
      pawn: '♙',
    },
    black: {
      king: '♚',
      queen: '♛',
      rook: '♜',
      bishop: '♝',
      knight: '♞',
      pawn: '♟',
    },
  };

  return (
    <View style={styles.container}>
      <Text style={styles.piece}>{pieceSymbols[color][type]}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  piece: {
    fontSize: 36,
  },
});

export default ChessPiece;
