import React from 'react';
import { KeyboardAvoidingView, Platform, StyleProp, ViewStyle } from 'react-native';

/**
 * Put this as the direct child of a <Modal> so the modal's content moves up above the keyboard.
 *
 * A KeyboardAvoidingView on the screen doesn't reach inside a Modal (modals render in their own
 * layer), so a bottom sheet with a text field would otherwise be covered by the keyboard —
 * including its buttons. The iOS number pad has no Return/Done key, so the user couldn't even
 * dismiss the keyboard to reach them.
 */
export default function KeyboardAvoidingModalView({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[{ flex: 1 }, style]}
    >
      {children}
    </KeyboardAvoidingView>
  );
}
