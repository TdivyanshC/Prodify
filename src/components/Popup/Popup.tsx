import LottieView, { AnimationObject } from 'lottie-react-native';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

export interface PopupAction {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
}

interface PopupProps {
  visible: boolean;
  onClose: () => void;
  message: string;
  lottieSource?: AnimationObject | { uri: string };
  actions?: PopupAction[];
}

// Generic reusable modal: Lottie animation + message + optional action
// buttons. Backs the mascot popup, badge-earned popup, friend-request
// popup, and confirmation dialogs (claude.md §2) so each one is a
// different set of props on this same component, not a one-off screen.
export function Popup({ visible, onClose, message, lottieSource, actions }: PopupProps) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          {lottieSource ? (
            <LottieView source={lottieSource} autoPlay loop style={styles.lottie} />
          ) : null}
          <Text style={styles.message}>{message}</Text>
          {actions && actions.length > 0 ? (
            <View style={styles.actionsRow}>
              {actions.map((action) => (
                <Pressable
                  key={action.label}
                  onPress={action.onPress}
                  style={[
                    styles.actionButton,
                    action.variant === 'secondary' && styles.actionButtonSecondary,
                  ]}
                >
                  <Text
                    style={[
                      styles.actionLabel,
                      action.variant === 'secondary' && styles.actionLabelSecondary,
                    ]}
                  >
                    {action.label}
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
  },
  lottie: {
    width: 120,
    height: 120,
  },
  message: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 12,
    color: '#1c1c1e',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  actionButton: {
    backgroundColor: '#ff8c32',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  actionButtonSecondary: {
    backgroundColor: '#f0f0f0',
  },
  actionLabel: {
    color: '#fff',
    fontWeight: '600',
  },
  actionLabelSecondary: {
    color: '#1c1c1e',
  },
});
