import React from 'react';
import BisetkaModal, { BisetkaModalButton } from '../components/BisetkaModal';

/**
 * BisetkaAlert - Custom alert system that replaces React Native's Alert
 * 
 * Usage (drop-in replacement for Alert.alert):
 * 
 * BisetkaAlert.alert('Title', 'Message');
 * 
 * BisetkaAlert.alert('Title', 'Message', [
 *   { text: 'Cancel', onPress: () => {} },
 *   { text: 'OK', onPress: () => {} }
 * ]);
 * 
 * BisetkaAlert.success('Success!', 'Operation completed');
 * BisetkaAlert.error('Error', 'Something went wrong');
 * BisetkaAlert.warning('Warning', 'Please be careful');
 */

let modalRef: {
  show: (
    title: string,
    message: string,
    buttons?: BisetkaModalButton[],
    type?: 'info' | 'success' | 'warning' | 'error'
  ) => void;
} | null = null;

export class BisetkaAlertContainer extends React.Component {
  state = {
    visible: false,
    title: '',
    message: '',
    buttons: [] as BisetkaModalButton[],
    type: 'info' as 'info' | 'success' | 'warning' | 'error',
  };

  componentDidMount() {
    modalRef = {
      show: (title, message, buttons = [], type = 'info') => {
        this.setState({
          visible: true,
          title,
          message,
          buttons,
          type,
        });
      },
    };
  }

  componentWillUnmount() {
    modalRef = null;
  }

  handleClose = () => {
    this.setState({ visible: false });
  };

  render() {
    const { visible, title, message, buttons, type } = this.state;

    return (
      <BisetkaModal
        visible={visible}
        title={title}
        message={message}
        buttons={buttons}
        onClose={this.handleClose}
        type={type}
      />
    );
  }
}

interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export class BisetkaAlert {
  /**
   * Show an info alert (default)
   */
  static alert(
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: { cancelable?: boolean }
  ): void {
    const mappedButtons = this.mapButtons(buttons);
    modalRef?.show(title, message || '', mappedButtons, 'info');
  }

  /**
   * Show a success alert
   */
  static success(title: string, message?: string, buttons?: AlertButton[]): void {
    const mappedButtons = this.mapButtons(buttons);
    modalRef?.show(title, message || '', mappedButtons, 'success');
  }

  /**
   * Show a warning alert
   */
  static warning(title: string, message?: string, buttons?: AlertButton[]): void {
    const mappedButtons = this.mapButtons(buttons);
    modalRef?.show(title, message || '', mappedButtons, 'warning');
  }

  /**
   * Show an error alert
   */
  static error(title: string, message?: string, buttons?: AlertButton[]): void {
    const mappedButtons = this.mapButtons(buttons);
    modalRef?.show(title, message || '', mappedButtons, 'error');
  }

  /**
   * Map React Native Alert buttons to BisetkaModal buttons
   */
  private static mapButtons(buttons?: AlertButton[]): BisetkaModalButton[] {
    if (!buttons || buttons.length === 0) {
      return [];
    }

    return buttons.map((button) => ({
      text: button.text,
      onPress: button.onPress || (() => {}),
      style: this.mapButtonStyle(button.style),
    }));
  }

  /**
   * Map React Native button styles to BisetkaModal styles
   */
  private static mapButtonStyle(
    style?: 'default' | 'cancel' | 'destructive'
  ): 'primary' | 'secondary' | 'danger' | 'success' {
    switch (style) {
      case 'destructive': return 'danger';
      case 'cancel': return 'secondary';
      default: return 'primary';
    }
  }
}

export default BisetkaAlert;
