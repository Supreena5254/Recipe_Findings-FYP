import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import api from "../api/api";

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 60) / 2;

export default function HomeScreen({ navigation }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [recommendedRecipes, setRecommendedRecipes] = useState([]);
  const [popularRecipes, setPopularRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // ✅ FIX 1: Track favorites as a Set of recipe_ids for efficient lookup
  const [favorites, setFavorites] = useState(new Set());

  useEffect(() => {
    fetchRecipes();
  }, []);

  // ✅ FIX: Clear search field whenever the HomeScreen comes back into focus
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setSearchQuery("");
    });
    return unsubscribe;
  }, [navigation]);

  const fetchRecipes = async () => {
    try {
      setLoading(true);

      // ✅ FIX 2: Fetch user favorites first
      await fetchFavorites();

      // ✅ FIX 2: Fetch recommended recipes based on USER PREFERENCES
      const recommendedResponse = await api.get("/recipes/recommended");
      const recipeData = recommendedResponse.data.recipes || recommendedResponse.data;
      setRecommendedRecipes(Array.isArray(recipeData) ? recipeData.slice(0, 6) : []);

      // Fetch popular recipes (sorted by rating)
      const popularRes = await api.get("/recipes?sortBy=popularity");
      setPopularRecipes(Array.isArray(popularRes.data) ? popularRes.data.slice(0, 6) : []);

    } catch (error) {
      console.error("❌ Error fetching recipes:", error.response?.data || error.message);
    } finally {
      setLoading(false);
    }
  };

  // ✅ FIX 1: Separate function to fetch favorites
  const fetchFavorites = async () => {
    try {
      const response = await api.get("/recipes/user/favorites");
      const favoriteIds = new Set(
        response.data.map((fav) => fav.recipe_id)
      );
      setFavorites(favoriteIds);
      console.log("✅ Favorites loaded:", Array.from(favoriteIds));
    } catch (error) {
      console.log("⚠️ Could not fetch favorites (user may not be logged in):", error.response?.status);
      setFavorites(new Set());
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRecipes();
    setRefreshing(false);
  };

  const handleSearch = () => {
    if (searchQuery.trim()) {
      navigation.navigate("SearchResults", { query: searchQuery });
    }
  };

  // ✅ FIX 1: Properly toggle favorite with immediate UI update
  const toggleFavorite = async (recipeId) => {
    try {
      const isFavorite = favorites.has(recipeId);

      // Optimistically update UI immediately
      const newFavorites = new Set(favorites);
      if (isFavorite) {
        newFavorites.delete(recipeId);
      } else {
        newFavorites.add(recipeId);
      }
      setFavorites(newFavorites);

      // Make API call
      if (isFavorite) {
        await api.delete(`/recipes/${recipeId}/favorite`);
        console.log("💔 Removed from favorites:", recipeId);
      } else {
        await api.post(`/recipes/${recipeId}/favorite`);
        console.log("❤️ Added to favorites:", recipeId);
      }

    } catch (error) {
      console.error("❌ Error toggling favorite:", error);
      // Revert on error
      await fetchFavorites();
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

  // ✅ FIX 1: Updated RecipeCard with working favorite toggle
  const RecipeCard = ({ recipe }) => {
    const imageUrl = recipe.image_url;
    const hasImage = imageUrl && imageUrl.trim() !== '';
    const isFavorite = favorites.has(recipe.recipe_id);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate("RecipeDetail", { recipeId: recipe.recipe_id })}
      >
        {/* Image or Icon */}
        {hasImage ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.recipeImage}
            onError={(e) => console.log('Image load error for recipe:', recipe.recipe_id)}
          />
        ) : (
          <View style={styles.imageBox}>
            <MaterialCommunityIcons
              name={getIconName(recipe.cuisine_type)}
              size={50}
              color="#16a34a"
            />
          </View>
        )}

        {/* ✅ FIX 1: Working heart icon with proper favorite state */}
        <TouchableOpacity
          style={styles.heart}
          onPress={(e) => {
            e.stopPropagation(); // Prevent card click
            toggleFavorite(recipe.recipe_id);
          }}
          activeOpacity={0.7}
        >
          <Feather
            name={isFavorite ? "heart" : "heart"}
            size={16}
            color={isFavorite ? "#ef4444" : "#999"}
            fill={isFavorite ? "#ef4444" : "none"}
          />
        </TouchableOpacity>

        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {recipe.title}
          </Text>
          <View style={styles.cardMeta}>
            <View style={styles.metaItem}>
              <Feather name="clock" size={11} color="#95A5A6" />
              <Text style={styles.metaText}>{recipe.cooking_time} min</Text>
            </View>
            <View style={styles.metaItem}>
              <Feather name="star" size={11} color="#FFD700" />
              <Text style={styles.metaText}>{recipe.rating}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const categories = [
    { name: "Breakfast", icon: "coffee", mealType: "Breakfast" },
    { name: "Lunch", icon: "sun", mealType: "Lunch" },
    { name: "Dinner", icon: "moon", mealType: "Dinner" },
    { name: "Snacks", icon: "package", mealType: "Snack" },
    { name: "Desserts", icon: "heart", mealType: "Dessert" },
    { name: "Drinks", icon: "droplet", mealType: "Drinks" },
    { name: "Soup", icon: "wind", mealType: "Soup" },
  ];

  const SectionHeader = ({ title, onSeeAll }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {onSeeAll && (
        <TouchableOpacity onPress={onSeeAll}>
          <Text style={styles.seeAllText}>See All</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const RecipeSection = ({ title, recipes, mealType }) => (
    <View style={styles.section}>
      <SectionHeader
        title={title}
        onSeeAll={mealType ? () => navigation.navigate("CategoryRecipes", {
          category: mealType,
          type: "mealType"
        }) : null}
      />
      {recipes.length > 0 ? (
        <View style={styles.grid}>
          {recipes.map((recipe) => (
            <RecipeCard key={recipe.recipe_id} recipe={recipe} />
          ))}
        </View>
      ) : (
        <Text style={styles.emptyText}>No recipes found</Text>
      )}
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={styles.loadingText}>Loading recipes...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Logo & Header */}
        <View style={styles.headerSection}>
          <View style={styles.logoRow}>
            <MaterialCommunityIcons name="chef-hat" size={32} color="#16a34a" />
            <Text style={styles.logoText}>CookMate</Text>
          </View>
          <Text style={styles.tagline}>Discover delicious recipes for every meal</Text>
        </View>

        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Feather name="search" size={18} color="#16a34a" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search recipes"
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
            onSubmitEditing={handleSearch}
            returnKeyType="search"
          />
        </View>

        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        >
          {categories.map((cat, index) => {
            const categoryColor = "#4ade80";

            return (
              <TouchableOpacity
                key={index}
                style={[styles.categoryCard, { backgroundColor: categoryColor }]}
                onPress={() => {
                  if (cat.mealType) {
                    navigation.navigate("CategoryRecipes", {
                      category: cat.mealType,
                      type: "mealType"
                    });
                  }
                }}
              >
                <Feather name={cat.icon} size={22} color="#FFF" />
                <Text style={styles.categoryLabel}>{cat.name}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Recommended Section */}
        {recommendedRecipes.length > 0 && (
          <RecipeSection
            title="🌟 Recommended For You"
            recipes={recommendedRecipes}
          />
        )}

        {/* Popular Recipes Section */}
        {popularRecipes.length > 0 && (
          <RecipeSection
            title="🔥 Popular Recipes"
            recipes={popularRecipes}
          />
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
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
  headerSection: {
    backgroundColor: "#fff",
    paddingTop: 10,
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  logoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  logoText: {
    fontSize: 24,
    fontWeight: "800",
    color: "#16a34a",
    marginLeft: 8,
  },
  tagline: {
    fontSize: 14,
    color: "#7F8C8D",
    marginTop: 4,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    marginHorizontal: 20,
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: "#2C3E50",
  },
  categoriesContainer: {
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 12,
  },
  categoryCard: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  categoryLabel: {
    fontSize: 11,
    color: "#FFF",
    fontWeight: "600",
    marginTop: 4,
    textAlign: "center",
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#2C3E50",
  },
  seeAllText: {
    fontSize: 14,
    color: "#16a34a",
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 15,
    gap: 15,
  },
  card: {
    width: CARD_WIDTH,
    backgroundColor: "#FFF",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  recipeImage: {
    width: '100%',
    height: 120,
    backgroundColor: '#dcfce7',
  },
  imageBox: {
    height: 120,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  heart: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "#FFF",
    padding: 6,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
    zIndex: 10,
  },
  cardContent: {
    padding: 10,
  },
  cardTitle: {
    fontWeight: "700",
    fontSize: 14,
    color: "#2C3E50",
    marginBottom: 6,
  },
  cardMeta: {
    flexDirection: "row",
    gap: 10,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  metaText: {
    fontSize: 11,
    color: "#95A5A6",
  },
  emptyText: {
    textAlign: "center",
    color: "#999",
    fontSize: 14,
    paddingVertical: 20,
  },
});