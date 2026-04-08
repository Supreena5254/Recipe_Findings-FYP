import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Dimensions,
  Alert,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import api from "../api/api";

const { width } = Dimensions.get('window');

export default function IngredientSearchScreen({ navigation }) {
  const [screenState, setScreenState] = useState('initial');
  const [ingredientInput, setIngredientInput] = useState("");
  const [ingredients, setIngredients] = useState([]);
  const [difficulty, setDifficulty] = useState("");
  const [servings, setServings] = useState("2");
  const [mealType, setMealType] = useState([]);
  const [dietaryPref, setDietaryPref] = useState([]);
  const [cuisine, setCuisine] = useState([]);
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  const [expandedRecipes, setExpandedRecipes] = useState([]);

  const addIngredient = () => {
    if (ingredientInput.trim()) {
      setIngredients([...ingredients, ingredientInput.trim()]);
      setIngredientInput("");
    }
  };

  const removeIngredient = (index) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const toggleSelection = (value, list, setList) => {
    if (list.includes(value)) {
      setList(list.filter((item) => item !== value));
    } else {
      setList([...list, value]);
    }
  };

  const calculateMatchPercentage = (recipe) => {
    // INGREDIENT MATCH ONLY — based purely on how many of the recipe's
    // actual ingredients the user has. 100% = user has ALL recipe ingredients.
    const recipeIngredientsList = typeof recipe.ingredients === 'string'
      ? recipe.ingredients.split(/[;\n]/).map(i => i.trim()).filter(Boolean)
      : [];

    if (recipeIngredientsList.length === 0 || ingredients.length === 0) {
      return 0;
    }

    const userIngredientsLower = ingredients.map(i => i.toLowerCase());

    // Count how many of the RECIPE's ingredients the user has
    const matchedCount = recipeIngredientsList.filter(recipeIng => {
      const recipeIngLower = recipeIng.toLowerCase();
      return userIngredientsLower.some(userIng =>
        recipeIngLower.includes(userIng) || userIng.includes(recipeIngLower)
      );
    }).length;

    return Math.round((matchedCount / recipeIngredientsList.length) * 100);
  };

  const getMissingIngredients = (recipe) => {
    const recipeIngredientsList = typeof recipe.ingredients === 'string'
      ? recipe.ingredients.split(';').map(i => i.trim())
      : [];

    const userIngredientsLower = ingredients.map(i => i.toLowerCase());

    const missing = recipeIngredientsList.filter(recipeIng => {
      const recipeIngLower = recipeIng.toLowerCase();
      return !userIngredientsLower.some(userIng =>
        recipeIngLower.includes(userIng) || userIng.includes(recipeIngLower)
      );
    });

    return missing;
  };

  // ✅ FIXED: Using correct endpoint and better error handling
  const findRecipes = async () => {
    if (ingredients.length === 0) {
      Alert.alert("Missing Ingredients", "Please add at least one ingredient to search");
      return;
    }

    setSearching(true);

    try {
      const params = new URLSearchParams();

      // Add ingredients (MANDATORY)
      params.append("ingredients", ingredients.join(","));

      // Add optional filters
      if (difficulty) {
        params.append("difficulty", difficulty);
      }

      if (mealType.length > 0) {
        params.append("mealType", mealType.join(","));
      }

      if (dietaryPref.length > 0) {
        params.append("dietary", dietaryPref.join(","));
      }

      if (cuisine.length > 0) {
        params.append("cuisine", cuisine.join(","));
      }

      console.log("\n========================================");
      console.log("🔍 INGREDIENT SEARCH");
      console.log("========================================");
      console.log("📋 Search Criteria:");
      console.log("  - Ingredients:", ingredients.join(", "));
      console.log("  - Difficulty:", difficulty || "Any");
      console.log("  - Meal Type:", mealType.length > 0 ? mealType.join(", ") : "Any");
      console.log("  - Dietary:", dietaryPref.length > 0 ? dietaryPref.join(", ") : "Any");
      console.log("  - Cuisine:", cuisine.length > 0 ? cuisine.join(", ") : "Any");
      console.log("\n🌐 API Call:");
      console.log(`  GET /recipes/search/ingredients?${params.toString()}`);

      // ✅ CRITICAL FIX: Use the correct endpoint
      const response = await api.get(`/recipes/search/ingredients?${params.toString()}`);

      console.log("\n✅ Response received:");
      console.log(`  Found: ${response.data?.length || 0} recipes`);

      if (response.data && Array.isArray(response.data)) {
        // Calculate match percentage
        const resultsWithMatch = response.data.map(recipe => ({
          ...recipe,
          matchPercentage: calculateMatchPercentage(recipe)
        }));

        // Sort by match percentage
        resultsWithMatch.sort((a, b) => b.matchPercentage - a.matchPercentage);

        console.log("\n📊 Top Results:");
        resultsWithMatch.slice(0, 5).forEach((r, i) => {
          console.log(`  ${i+1}. ${r.title} - ${r.matchPercentage}% match`);
          console.log(`     ${r.cuisine_type} | ${r.dietary_preference} | ${r.difficulty_level}`);
        });

        setSearchResults(resultsWithMatch);
        setScreenState('results');
      } else {
        console.log("⚠️ No results or invalid response format");
        setSearchResults([]);
        setScreenState('results');
      }

      console.log("========================================\n");

    } catch (error) {
      console.error("\n❌ SEARCH ERROR:");
      console.error("  Message:", error.message);
      console.error("  Response:", error.response?.data);
      console.error("  Status:", error.response?.status);
      console.error("========================================\n");

      Alert.alert(
        "Search Failed",
        `Unable to search recipes: ${error.response?.data?.error || error.message}`,
        [
          { text: "OK" },
          { text: "Try Again", onPress: () => findRecipes() }
        ]
      );
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const resetSearch = () => {
    setScreenState('initial');
    setIngredients([]);
    setDifficulty("");
    setServings("2");
    setMealType([]);
    setDietaryPref([]);
    setCuisine([]);
    setSearchResults([]);
    setExpandedRecipes([]);
  };

  const toggleExpandIngredients = (recipeId) => {
    if (expandedRecipes.includes(recipeId)) {
      setExpandedRecipes(expandedRecipes.filter(id => id !== recipeId));
    } else {
      setExpandedRecipes([...expandedRecipes, recipeId]);
    }
  };

  const getIconName = (cuisineType) => {
    const iconMap = {
      Nepali: "food",
      Indian: "food-variant",
      Chinese: "noodles",
      Italian: "pasta",
      Thai: "bowl-mix",
      Greek: "food-fork-drink",
      American: "hamburger",
      Japanese: "food-takeout-box",
      Mexican: "taco",
      "Middle Eastern": "pita",
    };
    return iconMap[cuisineType] || "food";
  };

  const getMatchColor = (percentage) => {
    if (percentage >= 80) return "#16a34a";
    if (percentage >= 60) return "#f59e0b";
    return "#ef4444";
  };

  // ============================================
  // SCREEN 1: INITIAL
  // ============================================
  if (screenState === 'initial') {
    return (
      <SafeAreaView style={styles.container}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.initialContainer}
        >
          <View style={styles.heroSection}>
            <View style={styles.iconCircle}>
              <MaterialCommunityIcons name="chef-hat" size={60} color="#16a34a" />
            </View>
            <Text style={styles.heroTitle}>What's in your kitchen?</Text>
            <Text style={styles.heroSubtitle}>
              Find delicious recipes based on the ingredients you have
            </Text>
          </View>

          <TouchableOpacity
            style={styles.searchBarContainer}
            onPress={() => setScreenState('form')}
            activeOpacity={0.7}
          >
            <Feather name="search" size={22} color="#16a34a" />
            <Text style={styles.searchPlaceholder}>
              Search by ingredients...
            </Text>
            <Feather name="arrow-right" size={22} color="#16a34a" />
          </TouchableOpacity>

          <View style={styles.featuresGrid}>
            <View style={styles.featureCard}>
              <View style={[styles.featureIcon, { backgroundColor: '#fef3c7' }]}>
                <Feather name="check-circle" size={24} color="#f59e0b" />
              </View>
              <Text style={styles.featureTitle}>Smart Matching</Text>
              <Text style={styles.featureText}>
                Recipes ranked by ingredient match
              </Text>
            </View>

            <View style={styles.featureCard}>
              <View style={[styles.featureIcon, { backgroundColor: '#dbeafe' }]}>
                <Feather name="filter" size={24} color="#3b82f6" />
              </View>
              <Text style={styles.featureTitle}>Flexible Search</Text>
              <Text style={styles.featureText}>
                Add as many filters as you want
              </Text>
            </View>

            <View style={styles.featureCard}>
              <View style={[styles.featureIcon, { backgroundColor: '#fce7f3' }]}>
                <MaterialCommunityIcons name="star-circle" size={24} color="#ec4899" />
              </View>
              <Text style={styles.featureTitle}>Priority Based</Text>
              <Text style={styles.featureText}>
                Ingredients are the top priority
              </Text>
            </View>

            <View style={styles.featureCard}>
              <View style={[styles.featureIcon, { backgroundColor: '#f0fdf4' }]}>
                <Feather name="target" size={24} color="#16a34a" />
              </View>
              <Text style={styles.featureTitle}>Best Matches</Text>
              <Text style={styles.featureText}>
                See how well each recipe fits
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ============================================
  // SCREEN 2: FORM
  // ============================================
  if (screenState === 'form') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.formHeader}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setScreenState('initial')}
          >
            <Feather name="arrow-left" size={24} color="#1f2937" />
          </TouchableOpacity>
          <View style={styles.headerTextContainer}>
            <Text style={styles.headerTitle}>Search Recipes</Text>
            <Text style={styles.headerSubtitle}>Fill in your preferences</Text>
          </View>
        </View>

        <ScrollView showsVerticalScrollIndicator={false}>
          {/* Ingredients */}
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="package-variant" size={20} color="#16a34a" />
              <Text style={styles.sectionTitle}>Ingredients *</Text>
            </View>

            <View style={styles.ingredientInputRow}>
              <TextInput
                style={styles.ingredientInput}
                placeholder="Add ingredient (e.g., chicken, potato)"
                value={ingredientInput}
                onChangeText={setIngredientInput}
                onSubmitEditing={addIngredient}
                autoCapitalize="none"
              />
              <TouchableOpacity
                style={styles.addButton}
                onPress={addIngredient}
              >
                <Feather name="plus" size={24} color="#FFF" />
              </TouchableOpacity>
            </View>

            {ingredients.length > 0 && (
              <View style={styles.ingredientsList}>
                {ingredients.map((ingredient, index) => (
                  <View key={index} style={styles.ingredientChip}>
                    <Text style={styles.ingredientChipText}>{ingredient}</Text>
                    <TouchableOpacity onPress={() => removeIngredient(index)}>
                      <Feather name="x" size={16} color="#16a34a" />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>

          {/* Difficulty */}
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="trending-up" size={20} color="#3b82f6" />
              <Text style={styles.sectionTitle}>Difficulty Level</Text>
            </View>
            <View style={styles.chipsContainer}>
              {['Beginner', 'Intermediate', 'Advanced'].map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.chip,
                    difficulty === level && styles.chipSelected
                  ]}
                  onPress={() => setDifficulty(difficulty === level ? "" : level)}
                >
                  <Text style={[
                    styles.chipText,
                    difficulty === level && styles.chipTextSelected
                  ]}>
                    {level}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Servings */}
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="account-group" size={20} color="#ec4899" />
              <Text style={styles.sectionTitle}>Servings</Text>
            </View>
            <View style={styles.servingsRow}>
              {['1 person', '2 people', '4 people', '6 people'].map((serving) => (
                <TouchableOpacity
                  key={serving}
                  style={[
                    styles.servingChip,
                    servings === serving.split(' ')[0] && styles.chipSelected
                  ]}
                  onPress={() => setServings(serving.split(' ')[0])}
                >
                  <Text style={[
                    styles.chipText,
                    servings === serving.split(' ')[0] && styles.chipTextSelected
                  ]}>
                    {serving}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Meal Type */}
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <Feather name="clock" size={20} color="#f59e0b" />
              <Text style={styles.sectionTitle}>Meal Type</Text>
            </View>
            <View style={styles.chipsContainer}>
              {['Breakfast', 'Lunch', 'Dinner', 'Snack'].map((meal) => (
                <TouchableOpacity
                  key={meal}
                  style={[
                    styles.chip,
                    mealType.includes(meal) && styles.chipSelected
                  ]}
                  onPress={() => toggleSelection(meal, mealType, setMealType)}
                >
                  <Text style={[
                    styles.chipText,
                    mealType.includes(meal) && styles.chipTextSelected
                  ]}>
                    {meal}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Dietary */}
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="leaf" size={20} color="#16a34a" />
              <Text style={styles.sectionTitle}>Dietary Preference</Text>
            </View>
            <View style={styles.chipsContainer}>
              {['Veg', 'Non-Veg', 'Vegan'].map((diet) => (
                <TouchableOpacity
                  key={diet}
                  style={[
                    styles.chip,
                    dietaryPref.includes(diet) && styles.chipSelected
                  ]}
                  onPress={() => toggleSelection(diet, dietaryPref, setDietaryPref)}
                >
                  <Text style={[
                    styles.chipText,
                    dietaryPref.includes(diet) && styles.chipTextSelected
                  ]}>
                    {diet}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Cuisine */}
          <View style={styles.formSection}>
            <View style={styles.sectionHeader}>
              <MaterialCommunityIcons name="earth" size={20} color="#ef4444" />
              <Text style={styles.sectionTitle}>Cuisine</Text>
            </View>
            <View style={styles.chipsContainer}>
              {['Nepali', 'Indian', 'Chinese', 'Italian', 'Thai', 'American'].map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.chip,
                    cuisine.includes(type) && styles.chipSelected
                  ]}
                  onPress={() => toggleSelection(type, cuisine, setCuisine)}
                >
                  <Text style={[
                    styles.chipText,
                    cuisine.includes(type) && styles.chipTextSelected
                  ]}>
                    {type}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Search Button */}
          <TouchableOpacity
            style={[
              styles.searchButton,
              ingredients.length === 0 && styles.searchButtonDisabled
            ]}
            onPress={findRecipes}
            disabled={ingredients.length === 0 || searching}
          >
            {searching ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Feather name="search" size={20} color="#FFF" />
                <Text style={styles.searchButtonText}>Find Recipes</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ============================================
  // SCREEN 3: RESULTS
  // ============================================
  if (searching) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={styles.loadingText}>Searching for recipes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.resultsHeader}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setScreenState('form')}
        >
          <Feather name="arrow-left" size={24} color="#1f2937" />
        </TouchableOpacity>

        <View style={styles.resultsHeaderText}>
          <Text style={styles.resultsTitle}>Recipes Found ({searchResults.length})</Text>
          <Text style={styles.resultsSubtitle}>Sorted by best match</Text>
        </View>

        <TouchableOpacity
          style={styles.resetButton}
          onPress={resetSearch}
        >
          <Feather name="refresh-cw" size={20} color="#16a34a" />
        </TouchableOpacity>
      </View>

      {searchResults.length === 0 ? (
        <View style={styles.emptyState}>
          <Feather name="search" size={60} color="#d1d5db" />
          <Text style={styles.emptyTitle}>No Recipes Found</Text>
          <Text style={styles.emptyText}>
            No recipes match your search criteria.{'\n'}
            Try removing some filters or using different ingredients.
          </Text>
          <TouchableOpacity
            style={styles.newSearchBtn}
            onPress={() => setScreenState('form')}
          >
            <Text style={styles.newSearchText}>Modify Search</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView style={styles.resultsContainer}>
          {searchResults.map((recipe) => {
            const missingIngredients = getMissingIngredients(recipe);
            const isExpanded = expandedRecipes.includes(recipe.recipe_id);
            const matchColor = getMatchColor(recipe.matchPercentage);

            return (
              <View key={recipe.recipe_id} style={styles.resultCard}>
                <View style={[styles.matchBadge, { backgroundColor: matchColor }]}>
                  <Text style={styles.matchPercentage}>{recipe.matchPercentage}%</Text>
                  <Text style={styles.matchLabel}>Match</Text>
                </View>

                {recipe.image_url ? (
                  <Image
                    source={{ uri: recipe.image_url }}
                    style={styles.resultImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.resultImagePlaceholder}>
                    <MaterialCommunityIcons
                      name={getIconName(recipe.cuisine_type)}
                      size={60}
                      color="#16a34a"
                    />
                  </View>
                )}

                <View style={styles.resultCardContent}>
                  <Text style={styles.resultTitle}>{recipe.title}</Text>

                  <View style={styles.resultTags}>
                    <View style={styles.resultTag}>
                      <Text style={styles.resultTagText}>{recipe.cuisine_type}</Text>
                    </View>
                    <View style={styles.resultTag}>
                      <Text style={styles.resultTagText}>{recipe.dietary_preference}</Text>
                    </View>
                    <View style={styles.resultTag}>
                      <Text style={styles.resultTagText}>{recipe.difficulty_level}</Text>
                    </View>
                  </View>

                  <View style={styles.resultMetaRow}>
                    <View style={styles.resultMetaItem}>
                      <Feather name="clock" size={14} color="#64748b" />
                      <Text style={styles.resultMetaText}>{recipe.cooking_time} min</Text>
                    </View>
                    <View style={styles.resultMetaItem}>
                      <Feather name="users" size={14} color="#64748b" />
                      <Text style={styles.resultMetaText}>{recipe.servings} servings</Text>
                    </View>
                    <View style={styles.resultMetaItem}>
                      <Feather name="star" size={14} color="#fbbf24" />
                      <Text style={styles.resultMetaText}>{recipe.rating}</Text>
                    </View>
                  </View>

                  {missingIngredients.length > 0 && (
                    <View style={styles.missingSection}>
                      <View style={styles.missingSectionHeader}>
                        <Feather name="info" size={14} color="#92400e" />
                        <Text style={styles.missingTitle}>
                          Also need ({missingIngredients.length}):
                        </Text>
                        <TouchableOpacity
                          style={styles.expandButton}
                          onPress={() => toggleExpandIngredients(recipe.recipe_id)}
                        >
                          <Text style={styles.expandButtonText}>
                            {isExpanded ? 'Hide' : 'All'}
                          </Text>
                          <Feather
                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                            size={12}
                            color="#92400e"
                          />
                        </TouchableOpacity>
                      </View>

                      {isExpanded ? (
                        <View style={styles.missingIngredientsContainer}>
                          {missingIngredients.map((ing, index) => (
                            <View key={index} style={styles.missingTag}>
                              <Text style={styles.missingTagText}>{ing}</Text>
                            </View>
                          ))}
                        </View>
                      ) : (
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                          style={styles.missingScrollView}
                        >
                          <View style={styles.missingIngredients}>
                            {missingIngredients.slice(0, 4).map((ing, index) => (
                              <View key={index} style={styles.missingTag}>
                                <Text style={styles.missingTagText}>{ing}</Text>
                              </View>
                            ))}
                          </View>
                        </ScrollView>
                      )}
                    </View>
                  )}

                  <TouchableOpacity
                    style={styles.viewRecipeBtn}
                    onPress={() => navigation.navigate('RecipeDetail', { recipeId: recipe.recipe_id })}
                  >
                    <Text style={styles.viewRecipeText}>Tap to View Recipe</Text>
                    <Feather name="arrow-right" size={18} color="#FFF" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
          <View style={{ height: 20 }} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

// Styles (keeping original styles)
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f9fafb",
  },
  initialContainer: {
    padding: 20,
  },
  heroSection: {
    alignItems: "center",
    paddingVertical: 40,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#1f2937",
    marginBottom: 12,
  },
  heroSubtitle: {
    fontSize: 16,
    color: "#6b7280",
    textAlign: "center",
    paddingHorizontal: 20,
  },
  searchBarContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    paddingHorizontal: 20,
    paddingVertical: 18,
    borderRadius: 16,
    marginTop: 32,
    marginBottom: 32,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
  },
  searchPlaceholder: {
    flex: 1,
    marginLeft: 12,
    fontSize: 16,
    color: "#9ca3af",
  },
  featuresGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  featureCard: {
    width: (width - 56) / 2,
    backgroundColor: "#FFF",
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  featureIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  featureTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 6,
  },
  featureText: {
    fontSize: 13,
    color: "#6b7280",
    lineHeight: 18,
  },
  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f3f4f6",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextContainer: {
    flex: 1,
    marginLeft: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
  },
  formSection: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1f2937",
  },
  ingredientInputRow: {
    flexDirection: "row",
    gap: 10,
  },
  ingredientInput: {
    flex: 1,
    backgroundColor: "#FFF",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    fontSize: 15,
  },
  addButton: {
    width: 50,
    height: 50,
    backgroundColor: "#16a34a",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  ingredientsList: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 12,
  },
  ingredientChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0fdf4",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#16a34a",
    gap: 6,
  },
  ingredientChipText: {
    fontSize: 14,
    color: "#16a34a",
    fontWeight: "600",
  },
  chipsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    borderWidth: 2,
    borderColor: "transparent",
  },
  chipSelected: {
    backgroundColor: "#f0fdf4",
    borderColor: "#16a34a",
  },
  chipText: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "600",
  },
  chipTextSelected: {
    color: "#16a34a",
  },
  servingsRow: {
    flexDirection: "row",
    gap: 10,
  },
  servingChip: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: "#f3f4f6",
    borderWidth: 2,
    borderColor: "transparent",
    alignItems: "center",
  },
  searchButton: {
    flexDirection: "row",
    backgroundColor: "#16a34a",
    marginHorizontal: 20,
    marginTop: 32,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#16a34a",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  searchButtonDisabled: {
    backgroundColor: "#86efac",
    shadowOpacity: 0.1,
  },
  searchButtonText: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "700",
  },
  resultsHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  resultsHeaderText: {
    flex: 1,
    marginLeft: 12,
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
  },
  resultsSubtitle: {
    fontSize: 13,
    color: "#6b7280",
    marginTop: 2,
  },
  resetButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#6b7280",
  },
  resultsContainer: {
    padding: 16,
  },
  resultCard: {
    backgroundColor: "#FFF",
    borderRadius: 16,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  matchBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  matchPercentage: {
    fontSize: 18,
    fontWeight: "800",
    color: "#FFF",
    textAlign: "center",
  },
  matchLabel: {
    fontSize: 10,
    color: "#FFF",
    textAlign: "center",
    marginTop: 2,
  },
  resultImage: {
    width: "100%",
    height: 180,
  },
  resultImagePlaceholder: {
    width: "100%",
    height: 180,
    backgroundColor: "#f0fdf4",
    alignItems: "center",
    justifyContent: "center",
  },
  resultCardContent: {
    padding: 16,
  },
  resultTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1f2937",
    marginBottom: 12,
  },
  resultTags: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  resultTag: {
    backgroundColor: "#f3f4f6",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  resultTagText: {
    fontSize: 11,
    color: "#6b7280",
    fontWeight: "600",
  },
  resultMetaRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 16,
  },
  resultMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  resultMetaText: {
    fontSize: 13,
    color: "#64748b",
  },
  viewRecipeBtn: {
    flexDirection: "row",
    backgroundColor: "#16a34a",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  viewRecipeText: {
    color: "#FFF",
    fontSize: 15,
    fontWeight: "700",
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1f2937",
    marginTop: 24,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 15,
    color: "#6b7280",
    textAlign: "center",
    marginBottom: 24,
    lineHeight: 22,
  },
  newSearchBtn: {
    backgroundColor: "#16a34a",
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
  },
  newSearchText: {
    color: "#FFF",
    fontSize: 16,
    fontWeight: "600",
  },
  missingSection: {
    backgroundColor: "#fef3c7",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#fde68a",
  },
  missingSectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8,
  },
  missingTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: "#92400e",
    flex: 1,
  },
  expandButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#FFF",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#fbbf24",
  },
  expandButtonText: {
    fontSize: 10,
    color: "#92400e",
    fontWeight: "600",
  },
  missingIngredientsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  missingScrollView: {
    flexGrow: 0,
  },
  missingIngredients: {
    flexDirection: "row",
    gap: 8,
    paddingRight: 10,
  },
  missingTag: {
    backgroundColor: "#FFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#fbbf24",
  },
  missingTagText: {
    fontSize: 11,
    color: "#92400e",
    fontWeight: "600",
  },
});