// import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Colors } from "../../constants/Colors";

export const Card = ({
  children,
  title,
  icon: IconComponent = null,
  style = {},
  onPress = null,
  activeOpacity = 0.7,
}) => {
  const content = (
    <>
      {(title || IconComponent) && (
        <View style={styles.header}>
          {IconComponent && (
            <View style={styles.iconBox}>
              <IconComponent size={18} color={Colors.primary} />
            </View>
          )}
          {title ? <Text style={styles.title}>{title}</Text> : null}
        </View>
      )}
      {children}
    </>
  );

  if (onPress) {
    return (
      <TouchableOpacity
        onPress={onPress}
        activeOpacity={activeOpacity}
        style={[styles.card, style]}
      >
        {content}
      </TouchableOpacity>
    );
  }

  return <View style={[styles.card, style]}>{content}</View>;
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.card,
    borderRadius: 4, // DESIGN.md: Máximo 4px de radio
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowOpacity: 0, // DESIGN.md: Cero sombras difusas
    elevation: 0,
    marginBottom: 12,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingBottom: 8,
  },
  iconBox: {
    marginRight: 8,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: Colors.text,
    letterSpacing: -0.1,
  },
});

export default Card;
