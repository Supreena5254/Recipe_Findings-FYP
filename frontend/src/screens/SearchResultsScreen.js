import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import api from "../api/api";

export default function SearchResultsScreen({ route, navigation }) {
  const { query } = route.params;
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState(new Set());
  // Track the displayed query separately so we can clear the HomeScreen field on back
  const displayQuery = query || "";

  useEffect(() => {
    searchRecipes();
    fetchFavorites();
  }, [query]);

  const fetchFavorites = async () => {
    try {
      const response = await api.get("/recipes/user/favorites");
      const favoriteIds = new Set(response.data.map((fav) => fav.recipe_id));
      setFavorites(favoriteIds);
    } catch (error) {
      console.log("⚠️ Could not fetch favorites:", error.response?.status);
      setFavorites(new Set());
    }
  };

  const searchRecipes = async () => {
    try {
      setLoading(true);

      console.log("🔍 Searching for:", query);

      // ✅ ULTIMATE FIX: Use the general /recipes endpoint with search parameter
      // This searches in title, description, AND ingredients
      const searchUrl = `/recipes?search=${encodeURIComponent(query)}`;
      console.log("📡 API Call:", searchUrl);

      const response = await api.get(searchUrl);
      console.log("✅ Search results:", response.data.length);

      setResults(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("❌ Search error:", error);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (recipeId) => {
    try {
      const isFavorite = favorites.has(recipeId);

      // Optimistic update
      const newFavorites = new Set(favorites);
      if (isFavorite) {
        newFavorites.delete(recipeId);
      } else {
        newFavorites.add(recipeId);
      }
      setFavorites(newFavorites);

      // API call
      if (isFavorite) {
        await api.delete(`/recipes/${recipeId}/favorite`);
      } else {
        await api.post(`/recipes/${recipeId}/favorite`);
      }
    } catch (error) {
      console.error("❌ Toggle favorite error:", error);
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

  const RecipeCard = ({ recipe }) => {
    const imageUrl = recipe.image_url;
    const hasImage = imageUrl && imageUrl.trim() !== '';
    const isFavorite = favorites.has(recipe.recipe_id);

    return (
      <TouchableOpacity
        style={styles.recipeCard}
        onPress={() => navigation.navigate("RecipeDetail", { recipeId: recipe.recipe_id })}
      >
        {/* Image or Icon */}
        {hasImage ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.recipeImageContainer}
            onError={(e) => console.log('Image load error for recipe:', recipe.recipe_id)}
          />
        ) : (
          <View style={styles.recipeImagePlaceholder}>
            <MaterialCommunityIcons
              name={getIconName(recipe.cuisine_type)}
              size={60}
              color="#16a34a"
            />
          </View>
        )}

        {/* Favorite heart button */}
        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={(e) => {
            e.stopPropagation();
            toggleFavorite(recipe.recipe_id);
          }}
          activeOpacity={0.7}
        >
          <Feather
            name="heart"
            size={20}
            color={isFavorite ? "#ef4444" : "#999"}
            fill={isFavorite ? "#ef4444" : "none"}
          />
        </TouchableOpacity>

        <View style={styles.recipeInfo}>
          <Text style={styles.recipeName} numberOfLines={1}>
            {recipe.title}
          </Text>
          {recipe.description && (
            <Text style={styles.recipeDescription} numberOfLines={2}>
              {recipe.description}
            </Text>
          )}

          <View style={styles.recipeDetails}>
            <View style={styles.detailItem}>
              <Feather name="clock" size={12} color="#64748b" />
              <Text style={styles.detailText}>{recipe.cooking_time} mins</Text>
            </View>
            <View style={styles.detailItem}>
              <Feather name="zap" size={12} color="#64748b" />
              <Text style={styles.detailText}>{recipe.calories} cal</Text>
            </View>
            <View style={styles.detailItem}>
              <Feather name="star" size={12} color="#fbbf24" />
              <Text style={styles.detailText}>{recipe.rating}</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={24} color="#1e293b" />
        </TouchableOpacity>
        <View style={styles.headerTextContainer}>
          <Text style={styles.headerTitle}>Search Results</Text>
          <Text style={styles.headerSubtitle}>"{query}"</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={styles.loadingText}>Searching recipes...</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false}>
          <View style={styles.content}>
            <Text style={styles.resultCount}>
              {results.length} recipe{results.length !== 1 ? "s" : ""} found
            </Text>

            {results.length > 0 ? (
              results.map((recipe) => (
                <RecipeCard key={recipe.recipe_id} recipe={recipe} />
              ))
            ) : (
              <View style={styles.emptyState}>
                <Feather name="search" size={60} color="#cbd5e1" />
                <Text style={styles.emptyText}>No recipes found</Text>
                <Text style={styles.emptySubtext}>
                  Try searching with different keywords
                </Text>
              </View>
            )}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextContainer: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1e293b",
  },
  headerSubtitle: {
    fontSize: 14,
    color: "#64748b",
    marginTop: 2,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: "#64748b",
  },
  content: {
    padding: 20,
  },
  resultCount: {
    fontSize: 16,
    fontWeight: "600",
    color: "#64748b",
    marginBottom: 16,
  },
  recipeCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    position: "relative",
  },
  recipeImageContainer: {
    width: 100,
    height: 100,
    backgroundColor: '#f1f5f9',
  },
  recipeImagePlaceholder: {
    width: 100,
    height: 100,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  favoriteButton: {
    position: "absolute",
    top: 8,
    right: 8,
    backgroundColor: "rgba(255, 255, 255, 0.95)",
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  recipeInfo: {
    flex: 1,
    padding: 12,
  },
  recipeName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1e293b",
    marginBottom: 4,
  },
  recipeDescription: {
    fontSize: 13,
    color: "#64748b",
    marginBottom: 8,
    lineHeight: 18,
  },
  recipeDetails: {
    flexDirection: "row",
    alignItems: "center",
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 12,
  },
  detailText: {
    fontSize: 12,
    color: "#64748b",
    marginLeft: 4,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#64748b",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#94a3b8",
    marginTop: 8,
    textAlign: "center",
  },
});