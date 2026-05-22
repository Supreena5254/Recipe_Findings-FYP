import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";

// Import screens
import LoginScreen from "./src/screens/LoginScreen";
import SignupScreen from "./src/screens/SignupScreen";
import OTPVerificationScreen from "./src/screens/OTPVerificationScreen";
import PreferenceFormScreen from "./src/screens/PreferenceFormScreen";
import ForgotPasswordScreen from "./src/screens/ForgotPasswordScreen";
import ResetPasswordScreen from "./src/screens/ResetPasswordScreen";
import MainTabs from "./src/navigation/MainTabs";
import RecipeDetailScreen from "./src/screens/RecipeDetailScreen";
import SearchResultsScreen from "./src/screens/SearchResultsScreen";
import CategoryRecipesScreen from "./src/screens/CategoryRecipesScreen";

// ✅ Import your Admin Panel screen
import AdminPanel from "./src/screens/Adminpanel";

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
          gestureEnabled: false,
        }}
      >
        {/* Auth Screens */}
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Signup" component={SignupScreen} />
        <Stack.Screen name="OTPVerification" component={OTPVerificationScreen} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
        <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />

        {/* Preferences (first-time only) */}
        <Stack.Screen name="PreferenceForm" component={PreferenceFormScreen} />

        {/* ✅ Admin Panel — only reachable if user.is_admin === true */}
        <Stack.Screen name="AdminPanel" component={AdminPanel} />

        {/* Main App */}
        <Stack.Screen name="MainTabs" component={MainTabs} />

        {/* Recipe Screens */}
        <Stack.Screen name="RecipeDetail" component={RecipeDetailScreen} />
        <Stack.Screen name="SearchResults" component={SearchResultsScreen} />
        <Stack.Screen name="CategoryRecipes" component={CategoryRecipesScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}