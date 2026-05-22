import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function AdminDashboard({ onLogout }) {
  const handleLogout = async () => {
    await AsyncStorage.removeItem("authToken");
    await AsyncStorage.removeItem("authUser");
    onLogout();
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🍳 CookMate Admin</Text>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logout}>Logout</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.welcome}>Welcome, Admin!</Text>
      {/* Add your admin content here */}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f0fdf4" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#d1fae5" },
  title: { fontSize: 20, fontWeight: "700", color: "#16a34a" },
  logout: { color: "#dc2626", fontWeight: "600" },
  welcome: { padding: 24, fontSize: 16, color: "#374151" },
});