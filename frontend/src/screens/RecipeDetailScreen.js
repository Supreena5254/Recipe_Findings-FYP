import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import api from "../api/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import RatingModal from "../components/RatingModal";
import RatingsListModal from "../components/RatingsListModal";

// ✅ NEW: Voice feature
import * as Speech from "expo-speech";

export default function RecipeDetailScreen({ route, navigation }) {
  const { recipeId } = route.params;
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);

  // Mark as Cooked states
  const [isCooked, setIsCooked]       = useState(false);
  const [cookingAnim, setCookingAnim] = useState(false);

  // Rating states
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showRatingsListModal, setShowRatingsListModal] = useState(false);
  const [ratingsData, setRatingsData] = useState(null);
  const [loadingRatings, setLoadingRatings] = useState(false);

  // ✅ NEW: Voice feature states
  const [voiceModeActive, setVoiceModeActive] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Refresh recipe details every time screen is focused
  useFocusEffect(
    React.useCallback(() => {
      fetchRecipeDetails();
      return () => {
        // ✅ NEW: Stop speech when leaving screen
        Speech.stop();
        setVoiceModeActive(false);
        setIsSpeaking(false);
        setCurrentStepIndex(0);
      };
    }, [recipeId])
  );

  const fetchRecipeDetails = async () => {
    try {
      setLoading(true);
      console.log("📖 Fetching recipe details for ID:", recipeId);

      const response = await api.get(`/recipes/${recipeId}`);

      console.log("✅ Recipe details received:");
      console.log("   Title:", response.data.title);
      console.log("   is_favorite:", response.data.is_favorite);
      console.log("   rating:", response.data.rating);
      console.log("   rating_count:", response.data.rating_count);

      setRecipe(response.data);

      // ✅ Track that this recipe was viewed (saves to DB + AsyncStorage)
      await saveViewedRecipe(response.data);

      // Set favorite state from backend response
      const favoriteStatus = response.data.is_favorite === true;
      setIsFavorite(favoriteStatus);

      console.log("❤️ Favorite status set to:", favoriteStatus);

      // Check if already marked as cooked today
      const cooked = await checkCookedToday(recipeId);
      setIsCooked(cooked);

    } catch (error) {
      console.error("❌ Error fetching recipe:", error);
      Alert.alert("Error", "Failed to load recipe details");
    } finally {
      setLoading(false);
    }
  };

  // ✅ UPDATED: Save to viewed_recipes in DB AND AsyncStorage
  const saveViewedRecipe = async (r) => {
    try {
      // 1. Save to AsyncStorage (for offline fallback)
      const raw  = await AsyncStorage.getItem("viewed_recipes");
      const list = raw ? JSON.parse(raw) : [];
      const today = new Date().toDateString();
      const alreadyToday = list.some(
        (e) => e.recipe_id === r.recipe_id &&
               new Date(e.viewed_at).toDateString() === today
      );
      if (!alreadyToday) {
        list.push({
          recipe_id: r.recipe_id,
          title:     r.title,
          calories:  Number(r.calories)  || 0,
          cuisine:   r.cuisine_type      || "",
          meal_type: r.meal_type         || "",
          viewed_at: new Date().toISOString(),
        });
        await AsyncStorage.setItem("viewed_recipes", JSON.stringify(list));
      }

      // 2. ✅ Also save to database
      await api.post("/activity/viewed", {
        recipe_id: r.recipe_id,
        title:     r.title,
        calories:  Number(r.calories) || 0,
        cuisine:   r.cuisine_type     || "",
        meal_type: r.meal_type        || "",
      });

      console.log("✅ Viewed recipe saved to DB:", r.recipe_id);
    } catch (e) {
      // Don't crash the app if this fails — it's non-critical
      console.warn("⚠️ saveViewedRecipe error (non-critical):", e.message);
    }
  };

  const toggleFavorite = async () => {
    try {
      console.log("\n💖 TOGGLING FAVORITE");
      console.log("Recipe ID:", recipeId);
      console.log("Current favorite status:", isFavorite);

      // Optimistic update
      const newFavoriteState = !isFavorite;
      setIsFavorite(newFavoriteState);
      console.log("⚡ Optimistic update to:", newFavoriteState);

      // Make API call
      const response = await api.post(`/recipes/${recipeId}/favorite`);

      console.log("✅ Toggle response:", response.data);
      console.log("   Server returned is_favorite:", response.data.is_favorite);

      // Update with server response
      setIsFavorite(response.data.is_favorite);

      setRecipe({
        ...recipe,
        is_favorite: response.data.is_favorite
      });

      console.log("✅ Final favorite status:", response.data.is_favorite);

    } catch (error) {
      console.error("❌ Toggle favorite error:", error);
      // Revert on error
      setIsFavorite(!isFavorite);
      Alert.alert("Error", "Failed to update favorite status");
    }
  };

  // ============================================
  // RATING FUNCTIONS
  // ============================================

  const fetchRatings = async () => {
    try {
      setLoadingRatings(true);
      console.log("📊 Fetching ratings for recipe:", recipeId);

      const response = await api.get(`/ratings/${recipeId}`);

      console.log("✅ Ratings data received:");
      console.log("   Total ratings:", response.data.stats?.total_ratings);
      console.log("   Average:", response.data.stats?.average_rating);
      console.log("   User has rated:", response.data.userRating !== null);

      setRatingsData(response.data);
    } catch (error) {
      console.error("❌ Error fetching ratings:", error);
      Alert.alert("Error", "Failed to load ratings");
    } finally {
      setLoadingRatings(false);
    }
  };

  const handleRatingClick = async () => {
    console.log("🌟 Rating card clicked - Recipe ID:", recipeId);
    await fetchRatings();
    setShowRatingsListModal(true);
  };

  const handleSubmitRating = async (rating, reviewText) => {
    try {
      console.log("\n📝 SUBMITTING RATING");
      console.log("Recipe ID:", recipeId);
      console.log("Rating:", rating);

      const response = await api.post(`/ratings/${recipeId}`, {
        rating,
        reviewText: null
      });

      console.log("✅ Rating submitted:", response.data);

      // Close modals FIRST
      setShowRatingModal(false);
      setShowRatingsListModal(false);

      // Show success message
      Alert.alert("Success! ⭐", "Your rating has been submitted");

      // Refresh recipe details to get updated rating
      await fetchRecipeDetails();

    } catch (error) {
      console.error("❌ Error submitting rating:", error);
      Alert.alert("Error", "Failed to submit rating. Please try again.");
      throw error;
    }
  };

  // ============================================
  // MARK AS COOKED HELPERS
  // ============================================

  // ✅ UPDATED: Save cooked recipe to DB AND AsyncStorage
  const saveCookedRecipe = async (r) => {
    try {
      const entry = {
        recipe_id: r.recipe_id,
        title:     r.title,
        calories:  Number(r.calories) || 0,
        protein:   Number(r.protein)  || 0,
        carbs:     Number(r.carbs)    || 0,
        fats:      Number(r.fats)     || 0,
        cuisine:   r.cuisine_type     || "",
        meal_type: r.meal_type        || "",
        cooked_at: new Date().toISOString(),
      };

      // 1. Save to AsyncStorage (for offline fallback)
      const raw = await AsyncStorage.getItem("cooked_recipes");
      const list = raw ? JSON.parse(raw) : [];
      const today = new Date().toDateString();
      const alreadyToday = list.some(
        (e) =>
          e.recipe_id === entry.recipe_id &&
          new Date(e.cooked_at).toDateString() === today
      );

      if (!alreadyToday) {
        list.push(entry);
        await AsyncStorage.setItem("cooked_recipes", JSON.stringify(list));
      }

      // 2. ✅ Save to database
      const dbResponse = await api.post("/activity/cooked", {
        recipe_id: r.recipe_id,
        title:     r.title,
        calories:  Number(r.calories) || 0,
        protein:   Number(r.protein)  || 0,
        carbs:     Number(r.carbs)    || 0,
        fats:      Number(r.fats)     || 0,
        cuisine:   r.cuisine_type     || "",
        meal_type: r.meal_type        || "",
      });

      console.log("✅ Cooked recipe saved to DB:", dbResponse.data);

      // Return false if already logged today (either in AsyncStorage or DB)
      return !alreadyToday && !dbResponse.data.alreadyLogged;
    } catch (e) {
      console.error("saveCookedRecipe error:", e);
      return false;
    }
  };

  const checkCookedToday = async (id) => {
    try {
      const raw = await AsyncStorage.getItem("cooked_recipes");
      if (!raw) return false;
      const list = JSON.parse(raw);
      const today = new Date().toDateString();
      return list.some(
        (e) =>
          e.recipe_id === id &&
          new Date(e.cooked_at).toDateString() === today
      );
    } catch {
      return false;
    }
  };

  const handleMarkAsCooked = async () => {
    if (isCooked) {
      Alert.alert(
        "Already Cooked Today! 🍳",
        "You've already marked this recipe as cooked today. It's counted in your weekly summary.",
        [{ text: "OK" }]
      );
      return;
    }
    Alert.alert(
      "Mark as Cooked? 🍳",
      `Did you cook "${recipe.title}" today? This will be added to your weekly activity summary.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Yes, I cooked it!",
          onPress: async () => {
            setCookingAnim(true);
            const added = await saveCookedRecipe(recipe);
            setCookingAnim(false);
            if (added) {
              setIsCooked(true);
              Alert.alert(
                "Great job! 🎉",
                `"${recipe.title}" has been added to your weekly summary.\n\n` +
                `+${recipe.calories || 0} kcal  •  ` +
                `+${recipe.protein  || 0}g protein  •  ` +
                `+${recipe.carbs    || 0}g carbs  •  ` +
                `+${recipe.fats     || 0}g fats`,
                [{ text: "Awesome!" }]
              );
            } else {
              setIsCooked(true);
              Alert.alert(
                "Already logged",
                "You already cooked this today — it's in your summary!",
                [{ text: "OK" }]
              );
            }
          },
        },
      ]
    );
  };

  // ============================================
  // ✅ NEW: VOICE FEATURE FUNCTIONS
  // ============================================

  const speakStep = (index, stepsArray) => {
    Speech.stop();
    setIsSpeaking(true);
    const text = stepsArray[index];
    Speech.speak(text, {
      language: "en-US",
      pitch: 1.0,
      rate: 0.9,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  const startVoiceMode = (stepsArray) => {
    if (!stepsArray || stepsArray.length === 0) {
      Alert.alert("No Steps", "This recipe has no steps to read.");
      return;
    }
    setVoiceModeActive(true);
    setCurrentStepIndex(0);
    speakStep(0, stepsArray);
  };

  const stopVoiceMode = () => {
    Speech.stop();
    setVoiceModeActive(false);
    setIsSpeaking(false);
    setCurrentStepIndex(0);
  };

  const goToNextStep = (stepsArray) => {
    const next = currentStepIndex + 1;
    if (next < stepsArray.length) {
      setCurrentStepIndex(next);
      speakStep(next, stepsArray);
    } else {
      Speech.speak("All steps completed! Enjoy your meal!", {
        language: "en-US",
        onDone: () => { setIsSpeaking(false); setVoiceModeActive(false); },
      });
    }
  };

  const goToPrevStep = (stepsArray) => {
    const prev = currentStepIndex - 1;
    if (prev >= 0) {
      setCurrentStepIndex(prev);
      speakStep(prev, stepsArray);
    }
  };

  const replayStep = (stepsArray) => {
    speakStep(currentStepIndex, stepsArray);
  };

  const addToGroceryList = async () => {
    try {
      const response = await api.post(`/grocery/add-recipe/${recipeId}`);
      console.log("✅ Added to grocery list:", response.data);

      Alert.alert(
        "Added to Grocery List! 🛒",
        `${recipe.title} ingredients have been added to your grocery list`,
        [
          { text: "OK" },
          {
            text: "View List",
            onPress: () => navigation.navigate("MainTabs", { screen: "Grocery" })
          }
        ]
      );
    } catch (error) {
      console.error("❌ Error adding to grocery list:", error);
      const errorMsg = error.response?.data?.message || "Failed to add to grocery list";

      if (errorMsg.includes("already in grocery list")) {
        Alert.alert("Already Added", "This recipe is already in your grocery list");
      } else {
        Alert.alert("Error", errorMsg);
      }
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={styles.loadingText}>Loading recipe...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!recipe) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={60} color="#ef4444" />
          <Text style={styles.errorText}>Recipe not found</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Parse ingredients
  const ingredients = typeof recipe.ingredients === 'string'
    ? recipe.ingredients.split(';').map(i => i.trim())
    : recipe.ingredients;

  // Parse quantities
  const quantities = typeof recipe.quantity === 'string'
    ? recipe.quantity.split(';').map(q => q.trim())
    : recipe.quantity || [];

  // Combine ingredients with quantities
  const ingredientsWithQuantities = ingredients.map((ingredient, index) => ({
    name: ingredient,
    quantity: quantities[index] || ''
  }));

  const steps = typeof recipe.steps === 'string'
    ? recipe.steps.split('|').map(s => s.trim()).filter(Boolean)
    : recipe.steps;

  // Check if recipe has an image
  const imageUrl = recipe.image_url;
  const hasImage = imageUrl && imageUrl.trim() !== '';

  // Format rating display
  const displayRating = recipe.rating ? parseFloat(recipe.rating).toFixed(1) : "0.0";
  const ratingCount = recipe.rating_count || 0;

  console.log("🎨 Rendering RecipeDetail");
  console.log("   isFavorite:", isFavorite);
  console.log("   Rating:", displayRating);
  console.log("   Rating count:", ratingCount);

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.iconButton}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={24} color="#2C3E50" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Recipe Details</Text>

        {/* Heart Button - RED when favorited */}
        <TouchableOpacity
          style={[
            styles.iconButton,
            isFavorite && styles.iconButtonFavorited
          ]}
          onPress={toggleFavorite}
          activeOpacity={0.7}
        >
          <Feather
            name="heart"
            size={24}
            color={isFavorite ? "#ef4444" : "#BDC3C7"}
            fill={isFavorite ? "#ef4444" : "none"}
          />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Recipe Image */}
        {hasImage ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.recipeImage}
            onError={(e) => console.log('Image load error:', e.nativeEvent.error)}
          />
        ) : (
          <View style={styles.imageContainer}>
            <MaterialCommunityIcons name="food" size={100} color="#16a34a" />
          </View>
        )}

        {/* Recipe Title */}
        <View style={styles.titleSection}>
          <Text style={styles.title}>{recipe.title}</Text>
          <Text style={styles.description}>{recipe.description}</Text>
        </View>

        {/* Mark as Cooked Button */}
        <View style={styles.cookedButtonWrapper}>
          <TouchableOpacity
            style={[styles.cookedButton, isCooked && styles.cookedButtonDone]}
            onPress={handleMarkAsCooked}
            activeOpacity={0.8}
            disabled={cookingAnim}
          >
            {cookingAnim ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <MaterialCommunityIcons
                  name={isCooked ? "check-circle" : "chef-hat"}
                  size={22}
                  color="#fff"
                />
                <Text style={styles.cookedButtonText}>
                  {isCooked ? "Cooked Today ✓" : "Mark as Cooked"}
                </Text>
              </>
            )}
          </TouchableOpacity>
          {isCooked && (
            <Text style={styles.cookedSubtext}>
              Nutrition counted in your weekly summary
            </Text>
          )}
        </View>

        {/* Recipe Info */}
        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <Feather name="clock" size={20} color="#FF6B6B" />
            <Text style={styles.infoLabel}>Time</Text>
            <Text style={styles.infoValue}>{recipe.cooking_time} min</Text>
          </View>

          <View style={styles.infoCard}>
            <Feather name="users" size={20} color="#FF6B6B" />
            <Text style={styles.infoLabel}>Servings</Text>
            <Text style={styles.infoValue}>{recipe.servings}</Text>
          </View>

          <View style={styles.infoCard}>
            <Feather name="zap" size={20} color="#FF6B6B" />
            <Text style={styles.infoLabel}>Calories</Text>
            <Text style={styles.infoValue}>{recipe.calories}</Text>
          </View>

          {/* CLICKABLE RATING CARD */}
          <TouchableOpacity
            style={styles.infoCard}
            onPress={handleRatingClick}
            activeOpacity={0.7}
          >
            <Feather name="star" size={20} color="#FFD700" />
            <Text style={styles.infoLabel}>Rating</Text>
            <Text style={styles.infoValue}>{displayRating}</Text>
          </TouchableOpacity>
        </View>

        {/* Tags */}
        <View style={styles.tagsSection}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{recipe.cuisine_type}</Text>
          </View>
          <View style={[styles.tag, styles.dietTag]}>
            <Text style={styles.tagText}>{recipe.dietary_preference}</Text>
          </View>
          <View style={[styles.tag, styles.difficultyTag]}>
            <Text style={styles.tagText}>{recipe.difficulty_level}</Text>
          </View>
          <View style={[styles.tag, styles.mealTag]}>
            <Text style={styles.tagText}>{recipe.meal_type}</Text>
          </View>
        </View>

        {/* Nutrition */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Nutrition</Text>
          <View style={styles.nutritionGrid}>
            <View style={styles.nutritionCard}>
              <Text style={styles.nutritionValue}>{recipe.protein}g</Text>
              <Text style={styles.nutritionLabel}>Protein</Text>
            </View>
            <View style={styles.nutritionCard}>
              <Text style={styles.nutritionValue}>{recipe.carbs}g</Text>
              <Text style={styles.nutritionLabel}>Carbs</Text>
            </View>
            <View style={styles.nutritionCard}>
              <Text style={styles.nutritionValue}>{recipe.fats}g</Text>
              <Text style={styles.nutritionLabel}>Fats</Text>
            </View>
          </View>
        </View>

        {/* Ingredients with Add to Grocery Button */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderWithButton}>
            <Text style={styles.sectionTitle}>Ingredients</Text>
            <TouchableOpacity
              style={styles.addToGroceryButton}
              onPress={addToGroceryList}
            >
              <Feather name="shopping-cart" size={16} color="#FFF" />
              <Text style={styles.addToGroceryText}>Add to List</Text>
            </TouchableOpacity>
          </View>

          {ingredientsWithQuantities.map((item, index) => (
            <View key={index} style={styles.ingredientItem}>
              <View style={styles.ingredientContent}>
                <View style={styles.bullet} />
                <Text style={styles.ingredientText}>{item.name}</Text>
                {item.quantity && (
                  <Text style={styles.quantityText}>{item.quantity}</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Instructions */}
        <View style={styles.section}>
          {/* ✅ NEW: Header row with Listen button */}
          <View style={styles.sectionHeaderWithButton}>
            <Text style={styles.sectionTitle}>Instructions</Text>
            <TouchableOpacity
              style={[styles.listenButton, voiceModeActive && styles.listenButtonActive]}
              onPress={() => voiceModeActive ? stopVoiceMode() : startVoiceMode(steps)}
            >
              <Feather name={voiceModeActive ? "volume-x" : "volume-2"} size={16} color="#FFF" />
              <Text style={styles.listenButtonText}>{voiceModeActive ? "Stop" : "Listen"}</Text>
            </TouchableOpacity>
          </View>

          {/* ✅ NEW: Hint when voice is active */}
          {voiceModeActive && (
            <View style={styles.voiceHint}>
              <Feather name="info" size={14} color="#16a34a" />
              <Text style={styles.voiceHintText}>Use ‹ › buttons below to navigate steps</Text>
            </View>
          )}

          {steps.map((step, index) => (
            <View
              key={index}
              style={[
                styles.stepItem,
                voiceModeActive && index === currentStepIndex && styles.stepItemActive,
              ]}
            >
              <View style={[
                styles.stepNumber,
                voiceModeActive && index === currentStepIndex && styles.stepNumberActive,
              ]}>
                <Text style={styles.stepNumberText}>{index + 1}</Text>
              </View>
              <Text style={[
                styles.stepText,
                voiceModeActive && index === currentStepIndex && styles.stepTextActive,
              ]}>
                {step}
              </Text>
            </View>
          ))}
        </View>

        {/* Allergens */}
        {recipe.allergens && recipe.allergens.trim() !== '' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Allergen Information</Text>
            <View style={styles.allergensContainer}>
              <Feather name="alert-circle" size={24} color="#ef4444" />
              <Text style={styles.allergensText}>{recipe.allergens}</Text>
            </View>
          </View>
        )}

        <View style={{ height: voiceModeActive ? 110 : 40 }} />
      </ScrollView>

      {/* ✅ NEW: Floating voice control bar */}
      {voiceModeActive && (
        <View style={styles.voiceBar}>
          <TouchableOpacity
            style={[styles.voiceNavBtn, currentStepIndex === 0 && styles.voiceNavBtnDisabled]}
            onPress={() => goToPrevStep(steps)}
            disabled={currentStepIndex === 0}
          >
            <Feather name="chevron-left" size={26} color="#FFF" />
          </TouchableOpacity>

          <View style={styles.voiceBarCenter}>
            <TouchableOpacity style={styles.replayBtn} onPress={() => replayStep(steps)}>
              <Feather name={isSpeaking ? "volume-2" : "repeat"} size={18} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.voiceBarText}>Step {currentStepIndex + 1} / {steps.length}</Text>
          </View>

          <TouchableOpacity
            style={[styles.voiceNavBtn, currentStepIndex === steps.length - 1 && styles.voiceNavBtnDisabled]}
            onPress={() => goToNextStep(steps)}
            disabled={currentStepIndex === steps.length - 1}
          >
            <Feather name="chevron-right" size={26} color="#FFF" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.voiceStopBtn} onPress={stopVoiceMode}>
            <Feather name="x" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>
      )}

      {/* RATING MODAL */}
      <RatingModal
        visible={showRatingModal}
        onClose={() => setShowRatingModal(false)}
        onSubmit={handleSubmitRating}
        recipeName={recipe?.title}
        existingRating={ratingsData?.userRating?.rating}
      />

      {/* RATINGS LIST MODAL */}
      <RatingsListModal
        visible={showRatingsListModal}
        onClose={() => setShowRatingsListModal(false)}
        stats={ratingsData?.stats}
        userRating={ratingsData?.userRating}
        onAddRating={() => {
          setShowRatingsListModal(false);
          setShowRatingModal(true);
        }}
        onEditRating={() => {
          setShowRatingsListModal(false);
          setShowRatingModal(true);
        }}
        loading={loadingRatings}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f0fdf4",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#666",
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorText: {
    fontSize: 20,
    fontWeight: "600",
    color: "#2C3E50",
    marginTop: 16,
    marginBottom: 24,
  },
  backButton: {
    backgroundColor: "#16a34a",
    paddingHorizontal: 32,
    paddingVertical: 12,
    borderRadius: 12,
  },
  backButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#2C3E50",
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F8F9FA",
    alignItems: "center",
    justifyContent: "center",
  },
  iconButtonFavorited: {
    backgroundColor: "#fee2e2",
  },
  recipeImage: {
    width: '100%',
    height: 250,
    backgroundColor: '#dcfce7',
  },
  imageContainer: {
    height: 200,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
  },
  titleSection: {
    padding: 20,
    backgroundColor: "#FFF",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#2C3E50",
    marginBottom: 8,
  },
  description: {
    fontSize: 16,
    color: "#7F8C8D",
    lineHeight: 24,
  },
  infoSection: {
    flexDirection: "row",
    paddingHorizontal: 20,
    marginVertical: 20,
    gap: 10,
  },
  infoCard: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoLabel: {
    fontSize: 12,
    color: "#95A5A6",
    marginTop: 8,
  },
  infoValue: {
    fontSize: 16,
    fontWeight: "700",
    color: "#2C3E50",
    marginTop: 4,
  },
  ratingCount: {
    fontSize: 11,
    color: "#999",
    marginTop: 2,
  },
  tagsSection: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 8,
  },
  tag: {
    backgroundColor: "#dcfce7",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  dietTag: {
    backgroundColor: "#fef3c7",
  },
  difficultyTag: {
    backgroundColor: "#dbeafe",
  },
  mealTag: {
    backgroundColor: "#fce7f3",
  },
  tagText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#2C3E50",
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#2C3E50",
    marginBottom: 16,
  },
  sectionHeaderWithButton: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  addToGroceryButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16a34a",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    shadowColor: "#16a34a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  addToGroceryText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  nutritionGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
  },
  nutritionCard: {
    flex: 1,
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 12,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  nutritionValue: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#16a34a",
  },
  nutritionLabel: {
    fontSize: 14,
    color: "#95A5A6",
    marginTop: 4,
  },
  ingredientItem: {
    marginBottom: 12,
    backgroundColor: "#FFF",
    padding: 12,
    borderRadius: 8,
  },
  ingredientContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#16a34a",
    marginRight: 12,
  },
  ingredientText: {
    flex: 1,
    fontSize: 16,
    color: "#2C3E50",
    lineHeight: 24,
  },
  quantityText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#16a34a",
    marginLeft: 12,
  },
  stepItem: {
    flexDirection: "row",
    marginBottom: 20,
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 12,
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#16a34a",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#FFF",
  },
  stepText: {
    flex: 1,
    fontSize: 16,
    color: "#2C3E50",
    lineHeight: 24,
  },
  allergensContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#FFD7D7",
  },
  allergensText: {
    flex: 1,
    fontSize: 16,
    color: "#C0392B",
    marginLeft: 12,
    fontWeight: "600",
  },

  // Mark as Cooked
  cookedButtonWrapper: {
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 4,
    alignItems: "center",
  },
  cookedButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: "#16a34a",
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 28,
    width: "100%",
    shadowColor: "#16a34a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  cookedButtonDone: {
    backgroundColor: "#16a34a",
    shadowColor: "#16a34a",
  },
  cookedButtonText: {
    color: "#fff",
    fontSize: 17,
    fontWeight: "700",
  },
  cookedSubtext: {
    marginTop: 6,
    fontSize: 12,
    color: "#16a34a",
    fontWeight: "500",
  },

  // ✅ NEW: Voice feature styles
  listenButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#16a34a",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    shadowColor: "#16a34a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  listenButtonActive: {
    backgroundColor: "#ef4444",
    shadowColor: "#ef4444",
  },
  listenButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "600",
  },
  voiceHint: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#dcfce7",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    marginBottom: 16,
    gap: 8,
  },
  voiceHintText: {
    fontSize: 13,
    color: "#15803d",
    fontWeight: "500",
  },
  stepItemActive: {
    backgroundColor: "#f0fdf4",
    borderLeftWidth: 4,
    borderLeftColor: "#16a34a",
  },
  stepNumberActive: {
    backgroundColor: "#15803d",
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  stepTextActive: {
    color: "#15803d",
    fontWeight: "600",
  },
  voiceBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#16a34a",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 10,
  },
  voiceBarCenter: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  voiceBarText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "700",
  },
  replayBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  voiceNavBtn: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  voiceNavBtnDisabled: {
    opacity: 0.35,
  },
  voiceStopBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
});