import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import api from "../api/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { getMinioBaseUrl, buildImageUrl } from "../utils/imageUrl"; // ✅ dynamic import

const CategoryRecipesScreen = ({ route, navigation }) => {
  const { category, type } = route.params;
  const [recipes, setRecipes] = useState([]);
  const [filteredRecipes, setFilteredRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [favorites, setFavorites] = useState([]);
  const [minioBaseUrl, setMinioBaseUrl] = useState(null); // ✅ inside component

  useEffect(() => {
    getMinioBaseUrl().then(setMinioBaseUrl); // ✅ fetch once on mount
    fetchRecipes();
    fetchFavorites();
  }, [category, type]);

  useEffect(() => {
    filterRecipes();
  }, [searchQuery, recipes]);

  const fetchFavorites = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (token) {
        const response = await api.get("/recipes/user/favorites");
        setFavorites(response.data.map((fav) => fav.recipe_id));
      }
    } catch (error) {
      console.log("Error fetching favorites:", error);
    }
  };

  const fetchRecipes = async () => {
    try {
      setLoading(true);
      console.log("🔍 Fetching recipes for category:", category, "type:", type);

      let response;
      if (type === "mealType") {
        response = await api.get(`/recipes?mealType=${category}`);
      } else {
        response = await api.get(`/recipes?cuisine=${category}`);
      }

      console.log("✅ Received recipes:", response.data.length);
      setRecipes(response.data);
      setFilteredRecipes(response.data);
    } catch (error) {
      console.error("❌ Error fetching recipes:", error);
      setRecipes([]);
      setFilteredRecipes([]);
    } finally {
      setLoading(false);
    }
  };

  const filterRecipes = () => {
    if (searchQuery.trim() === "") {
      setFilteredRecipes(recipes);
    } else {
      const filtered = recipes.filter((recipe) =>
        recipe.title.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredRecipes(filtered);
    }
  };

  const toggleFavorite = async (recipeId) => {
    try {
      const isFavorite = favorites.includes(recipeId);
      if (isFavorite) {
        await api.delete(`/recipes/${recipeId}/favorite`);
        setFavorites(favorites.filter((id) => id !== recipeId));
      } else {
        await api.post(`/recipes/${recipeId}/favorite`);
        setFavorites([...favorites, recipeId]);
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
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

  const renderRecipeCard = ({ item }) => {
    // ✅ uses dynamic minioBaseUrl — works on both WiFi and hotspot
    const imageUrl = minioBaseUrl ? buildImageUrl(minioBaseUrl, item.image_url) : null;
    const hasImage = imageUrl !== null;

    return (
      <TouchableOpacity
        style={styles.recipeCard}
        onPress={() => navigation.navigate("RecipeDetail", { recipeId: item.recipe_id })}
      >
        {hasImage ? (
          <Image
            source={{ uri: imageUrl }}
            style={styles.recipeImage}
            onError={() => console.log('❌ Image load error for recipe:', item.recipe_id, '| URL:', imageUrl)}
            onLoad={() => console.log('✅ Image loaded:', item.recipe_id)}
          />
        ) : (
          <View style={styles.recipeImagePlaceholder}>
            <MaterialCommunityIcons
              name={getIconName(item.cuisine_type)}
              size={50}
              color="#16a34a"
            />
          </View>
        )}

        <View style={styles.recipeInfo}>
          <Text style={styles.recipeTitle} numberOfLines={2}>
            {item.title}
          </Text>
          <View style={styles.recipeMetaContainer}>
            <View style={styles.recipeMetaItem}>
              <Ionicons name="time-outline" size={16} color="#16a34a" />
              <Text style={styles.recipeMetaText}>{item.cooking_time} min</Text>
            </View>
            <View style={styles.recipeMetaItem}>
              <Ionicons name="flame-outline" size={16} color="#f97316" />
              <Text style={styles.recipeMetaText}>{item.difficulty_level}</Text>
            </View>
          </View>
        </View>
        <TouchableOpacity
          style={styles.favoriteButton}
          onPress={() => toggleFavorite(item.recipe_id)}
        >
          <Ionicons
            name={favorites.includes(item.recipe_id) ? "heart" : "heart-outline"}
            size={24}
            color={favorites.includes(item.recipe_id) ? "#ef4444" : "#999"}
          />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#16a34a" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{category} Recipes</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color="#666" style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search recipes..."
          placeholderTextColor="#999"
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {filteredRecipes.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="restaurant-outline" size={64} color="#ccc" />
          <Text style={styles.emptyText}>No recipes found for {category}</Text>
        </View>
      ) : (
        <FlatList
          data={filteredRecipes}
          renderItem={renderRecipeCard}
          keyExtractor={(item) => item.recipe_id.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  backButton: {
    padding: 5,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#333",
  },
  placeholder: {
    width: 34,
  },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    borderRadius: 12,
    paddingHorizontal: 15,
    height: 50,
    margin: 20,
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#333",
  },
  listContainer: {
    padding: 20,
    paddingTop: 10,
  },
  recipeCard: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderRadius: 15,
    marginBottom: 15,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  recipeImage: {
    width: 120,
    height: 120,
    backgroundColor: '#dcfce7',
  },
  recipeImagePlaceholder: {
    width: 120,
    height: 120,
    backgroundColor: '#dcfce7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  recipeInfo: {
    flex: 1,
    padding: 12,
    justifyContent: "center",
  },
  recipeTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    marginBottom: 8,
  },
  recipeMetaContainer: {
    flexDirection: "row",
    gap: 15,
  },
  recipeMetaItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  recipeMetaText: {
    fontSize: 13,
    color: "#666",
    marginLeft: 4,
  },
  favoriteButton: {
    position: "absolute",
    top: 10,
    right: 10,
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 20,
    padding: 6,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 16,
    color: "#999",
    marginTop: 15,
    textAlign: "center",
  },
});

export default CategoryRecipesScreen;