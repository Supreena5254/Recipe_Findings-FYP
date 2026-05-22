import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import api from "../api/api";
import AsyncStorage from "@react-native-async-storage/async-storage";

const COLORS = {
  primary: "#4CAF50",
  darkGreen: "#2E7D32",
  mediumGreen: "#43A047",
  lightGreen: "#F1F8F1",
  cardGreen: "#E8F5E9",
  borderGreen: "#C8E6C9",
  textDark: "#1B1B1B",
  textGray: "#757575",
  white: "#FFFFFF",
  red: "#E53935",
};

export default function LoginScreen({ navigation }) {
  const [activeTab, setActiveTab] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert("Error", "Please enter both email and password");
      return;
    }
    setLoading(true);
    try {
      const response = await api.post("/auth/login", {
        email: email.trim(),
        password,
      });

      const { token, user } = response.data;

      // Save token and user info
      await AsyncStorage.setItem("authToken", token);
      await AsyncStorage.setItem("userId", user.id.toString());
      await AsyncStorage.setItem("userEmail", user.email);
      await AsyncStorage.setItem("authUser", JSON.stringify(user));

      // ✅ ADMIN CHECK FIRST — before anything else
      if (user.is_admin) {
        navigation.reset({ index: 0, routes: [{ name: "AdminPanel" }] });
        return;
      }

      // Normal user → check preferences
      try {
        const profileResponse = await api.get("/auth/profile");
        const hasPreferences =
          profileResponse.data.user.diet_type !== null ||
          profileResponse.data.user.skill_level !== null ||
          profileResponse.data.user.meal_goal !== null;

        if (hasPreferences) {
          await AsyncStorage.setItem("preferences_completed", "true");
          navigation.reset({ index: 0, routes: [{ name: "MainTabs" }] });
        } else {
          navigation.reset({ index: 0, routes: [{ name: "PreferenceForm" }] });
        }
      } catch {
        navigation.reset({ index: 0, routes: [{ name: "PreferenceForm" }] });
      }
    } catch (error) {
      if (error.response?.data?.requiresVerification === true) {
        Alert.alert(
          "Email Not Verified",
          "Please verify your email before logging in.",
          [
            { text: "Cancel", style: "cancel" },
            {
              text: "Verify Now",
              onPress: () =>
                navigation.navigate("OTPVerification", {
                  email: email.trim(),
                  fromLogin: true,
                }),
            },
          ]
        );
      } else {
        Alert.alert(
          "Login Failed",
          error.response?.data?.error || "Invalid email or password"
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── LOGO ── */}
        <View style={styles.logoRow}>
          <MaterialCommunityIcons
            name="chef-hat"
            size={38}
            color={COLORS.mediumGreen}
            style={{ marginRight: 8 }}
          />
          <Text style={styles.logoText}>CookMate</Text>
        </View>

        {/* ── HEADLINE ── */}
        <Text style={styles.welcomeTitle}>Welcome Back</Text>
        <Text style={styles.welcomeSub}>Sign in to continue</Text>

        {/* ── CARD ── */}
        <View style={styles.card}>

          {/* Tab Row */}
          <View style={styles.tabRow}>
            <TouchableOpacity
              style={[styles.tab, activeTab === "signin" && styles.tabActive]}
              onPress={() => setActiveTab("signin")}
              disabled={loading}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "signin" && styles.tabTextActive,
                ]}
              >
                Sign in
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === "signup" && styles.tabActive]}
              onPress={() => {
                setActiveTab("signup");
                navigation.navigate("Signup");
              }}
              disabled={loading}
            >
              <Text
                style={[
                  styles.tabText,
                  activeTab === "signup" && styles.tabTextActive,
                ]}
              >
                Sign up
              </Text>
            </TouchableOpacity>
          </View>

          {/* Username / Email */}
          <View style={styles.inputRow}>
            <Feather name="user" size={18} color={COLORS.mediumGreen} />
            <TextInput
              style={styles.input}
              placeholder="Username"
              placeholderTextColor="#AAAAAA"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          {/* Password */}
          <View style={styles.inputRow}>
            <Feather name="lock" size={18} color={COLORS.mediumGreen} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor="#AAAAAA"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              editable={!loading}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              disabled={loading}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather
                name={showPassword ? "eye" : "eye-off"}
                size={18}
                color="#AAAAAA"
              />
            </TouchableOpacity>
          </View>

          {/* Remember me + Forgot */}
          <View style={styles.rememberRow}>
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setRememberMe(!rememberMe)}
              disabled={loading}
            >
              <View style={[styles.checkbox, rememberMe && styles.checkboxChecked]}>
                {rememberMe && (
                  <Feather name="check" size={11} color={COLORS.white} />
                )}
              </View>
              <Text style={styles.rememberText}>Remember me</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => navigation.navigate("ForgotPassword")}
              disabled={loading}
            >
              <Text style={styles.forgotText}>Forgot password?</Text>
            </TouchableOpacity>
          </View>

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.loginBtn, loading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <Text style={styles.loginBtnText}>Login</Text>
            )}
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.white,
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 48,
  },

  /* Logo */
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  logoText: {
    fontSize: 30,
    fontWeight: "800",
    color: COLORS.mediumGreen,
    letterSpacing: 0.3,
  },

  /* Headline */
  welcomeTitle: {
    fontSize: 28,
    fontWeight: "700",
    color: COLORS.darkGreen,
    marginBottom: 6,
    textAlign: "center",
  },
  welcomeSub: {
    fontSize: 15,
    color: COLORS.textGray,
    marginBottom: 28,
    textAlign: "center",
  },

  /* Card */
  card: {
    width: "100%",
    backgroundColor: COLORS.cardGreen,
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 28,
    shadowColor: "#2E7D32",
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },

  /* Tabs */
  tabRow: {
    flexDirection: "row",
    marginBottom: 24,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGreen,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: COLORS.darkGreen,
  },
  tabText: {
    fontSize: 15,
    fontWeight: "500",
    color: COLORS.textGray,
  },
  tabTextActive: {
    color: COLORS.darkGreen,
    fontWeight: "700",
  },

  /* Inputs */
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderGreen,
    paddingVertical: 12,
    marginBottom: 14,
  },
  input: {
    flex: 1,
    marginLeft: 10,
    fontSize: 15,
    color: COLORS.textDark,
  },

  /* Remember / Forgot row */
  rememberRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
    marginBottom: 24,
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: COLORS.mediumGreen,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 7,
  },
  checkboxChecked: {
    backgroundColor: COLORS.mediumGreen,
    borderColor: COLORS.mediumGreen,
  },
  rememberText: {
    fontSize: 13,
    color: COLORS.textGray,
  },
  forgotText: {
    fontSize: 13,
    color: COLORS.red,
    fontWeight: "600",
  },

  /* Login button */
  loginBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 50,
    height: 50,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: COLORS.darkGreen,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  loginBtnDisabled: {
    backgroundColor: "#A5D6A7",
  },
  loginBtnText: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: "700",
    letterSpacing: 0.4,
  },
});