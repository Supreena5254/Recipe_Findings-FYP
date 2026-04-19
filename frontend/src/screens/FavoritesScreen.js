import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Image,
} from "react-native";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import api from "../api/api";
import { getMinioBaseUrl, buildImageUrl } from "../utils/imageUrl"; // ✅ dynamic import

export default function FavoritesScreen({ navigation }) {
  const [favorites, setFavorites] = useState([]);
  const [filteredFavorites, setFilteredFavorites] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [minioBaseUrl, setMinioBaseUrl] = useState(null); // ✅ inside component

  useEffect(() => {
    getMinioBaseUrl().then(setMinioBaseUrl); // ✅ fetch once on mount
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      fetchFavorites();
    }, [])
  );

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredFavorites(favorites);
    } else {
      const filtered = favorites.filter((recipe) =>
        recipe.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredFavorites(filtered);
    }
  }, [searchQuery, favorites]);

  const fetchFavorites = async () => {
    try {
      setLoading(true);
      const response = await api.get("/recipes/user/favorites");
      console.log("✅ Favorites loaded:", response.data);
      setFavorites(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error("❌ Error fetching favorites:", error);
      setFavorites([]);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchFavorites();
    setRefreshing(false);
  };

  const toggleFavorite = async (recipeId) => {
    try {
      const newFavorites = favorites.filter((recipe) => recipe.recipe_id !== recipeId);
      setFavorites(newFavorites);
      await api.post(`/recipes/${recipeId}/favorite`);
      console.log("💔 Removed from favorites:", recipeId);
    } catch (error) {
      console.error("❌ Error toggling favorite:", error);
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
    // ✅ uses dynamic minioBaseUrl — works on both WiFi and hotspot
    const imageUrl = minioBaseUrl ? buildImageUrl(minioBaseUrl, recipe.image_url) : null;
    const hasImage = imageUrl !== null;

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() =>
          navigation.navigate("RecipeDetail", { recipeId: recipe.recipe_id })
        }
      >
        {hasImage ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.recipeImage}
            onError={() => console.log('❌ Image load error for recipe:', recipe.recipe_id, '| URL:', imageUrl)}
            onLoad={() => console.log('✅ Image loaded:', recipe.recipe_id)}
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

        <TouchableOpacity
          style={styles.heart}
          onPress={(e) => {
            e.stopPropagation();
            toggleFavorite(recipe.recipe_id);
          }}
          activeOpacity={0.7}
        >
          <Feather name="heart" size={18} color="#ef4444" fill="#ef4444" />
        </TouchableOpacity>

        <View style={styles.cardContent}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {recipe.title}
          </Text>
          <View style={styles.cardMeta}>
            <View style={styles.metaItem}>
              <Feather name="clock" size={12} color="#95A5A6" />
              <Text style={styles.metaText}>{recipe.cooking_time} min</Text>
            </View>
            <View style={styles.metaItem}>
              <Feather name="zap" size={12} color="#95A5A6" />
              <Text style={styles.metaText}>{recipe.calories} cal</Text>
            </View>
          </View>
          <View style={styles.ratingContainer}>
            <Feather name="star" size={12} color="#FFD700" />
            <Text style={styles.ratingText}>{recipe.rating}</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={styles.loadingText}>Loading favorites...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerSection}>
        <Text style={styles.title}>Favorites</Text>
        <Text style={styles.subtitle}>
          {favorites.length} recipe{favorites.length !== 1 ? "s" : ""}
        </Text>
      </View>

      {favorites.length > 0 && (
        <View style={styles.searchBox}>
          <Feather name="search" size={18} color="#16a34a" />
          <TextInput
            placeholder="Search your favorites"
            placeholderTextColor="#95A5A6"
            style={styles.searchInput}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")}>
              <Feather name="x" size={18} color="#95A5A6" />
            </TouchableOpacity>
          )}
        </View>
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {filteredFavorites.length > 0 ? (
          <View style={styles.grid}>
            {filteredFavorites.map((recipe) => (
              <RecipeCard key={recipe.recipe_id} recipe={recipe} />
            ))}
          </View>
        ) : favorites.length > 0 && searchQuery.trim() !== "" ? (
          <View style={styles.emptyState}>
            <Feather name="search" size={60} color="#E0E0E0" />
            <Text style={styles.emptyTitle}>No recipes found</Text>
            <Text style={styles.emptySubtitle}>
              Try searching with different keywords
            </Text>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Feather name="heart" size={80} color="#E0E0E0" />
            <Text style={styles.emptyTitle}>No favorites yet</Text>
            <Text style={styles.emptySubtitle}>
              Tap the heart icon on recipes to add them to your favorites
            </Text>
          </View>
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
    padding: 20,
    paddingBottom: 10,
    backgroundColor: "#FFF",
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#2C3E50",
  },
  subtitle: {
    fontSize: 14,
    color: "#95A5A6",
    marginTop: 4,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF",
    marginHorizontal: 20,
    marginTop: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchInput: {
    marginLeft: 10,
    flex: 1,
    fontSize: 16,
    color: "#2C3E50",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 15,
    paddingTop: 20,
    gap: 16,
  },
  card: {
    width: "47%",
    backgroundColor: "#FFF",
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  recipeImage: {
    width: '100%',
    height: 130,
    backgroundColor: '#dcfce7',
  },
  imageBox: {
    height: 130,
    backgroundColor: "#dcfce7",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  heart: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "#FFF",
    padding: 8,
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 10,
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontWeight: "700",
    fontSize: 15,
    color: "#2C3E50",
    marginBottom: 8,
  },
  cardMeta: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 6,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 12,
    color: "#95A5A6",
  },
  ratingContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  ratingText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#2C3E50",
  },
  emptyState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#2C3E50",
    marginTop: 24,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 15,
    color: "#95A5A6",
    textAlign: "center",
    lineHeight: 22,
  },
});