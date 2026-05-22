import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Animated,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect } from "@react-navigation/native";
import api from "../api/api";

export default function GroceryScreen() {
  const [groceryList, setGroceryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  useFocusEffect(
    React.useCallback(() => {
      loadGroceryList();
    }, [])
  );

  const loadGroceryList = async () => {
    try {
      setLoading(true);
      const response = await api.get("/grocery");
      setGroceryList(response.data);
    } catch (error) {
      console.error("❌ Error loading grocery list:", error);
      setGroceryList([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleExpand = (groceryId) => {
    setExpandedId(prev => prev === groceryId ? null : groceryId);
  };

  const toggleIngredient = async (groceryId, ingredientIndex) => {
    try {
      const response = await api.put(`/grocery/toggle/${groceryId}`, {
        ingredientIndex,
      });

      setGroceryList(prevList =>
        prevList.map(item =>
          item.grocery_id === groceryId
            ? { ...item, ingredients: response.data.groceryItem.ingredients }
            : item
        )
      );

      const updatedItem = response.data.groceryItem;
      const allChecked = updatedItem.ingredients.every(ing => ing.checked);

      if (allChecked) {
        setTimeout(() => {
          Alert.alert(
            "All Done! 🎉",
            `All ingredients for "${updatedItem.recipe_name}" are checked. Remove from list?`,
            [
              { text: "Keep It", style: "cancel" },
              { text: "Remove", onPress: () => deleteGroceryItem(groceryId) },
            ]
          );
        }, 300);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to update ingredient");
    }
  };

  const deleteGroceryItem = async (groceryId) => {
    try {
      await api.delete(`/grocery/${groceryId}`);
      setGroceryList(prev => prev.filter(item => item.grocery_id !== groceryId));
      if (expandedId === groceryId) setExpandedId(null);
    } catch (error) {
      Alert.alert("Error", "Failed to delete item");
    }
  };

  const confirmDeleteItem = (groceryId, recipeName) => {
    Alert.alert(
      "Remove Recipe",
      `Remove "${recipeName}" from your grocery list?`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Remove", style: "destructive", onPress: () => deleteGroceryItem(groceryId) },
      ]
    );
  };

  const clearAll = () => {
    Alert.alert("Clear All", "Remove all recipes from your grocery list?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Clear",
        style: "destructive",
        onPress: async () => {
          try {
            await api.delete("/grocery");
            setGroceryList([]);
            setExpandedId(null);
          } catch {
            Alert.alert("Error", "Failed to clear list");
          }
        },
      },
    ]);
  };

  const RecipeRow = ({ item }) => {
    const isExpanded = expandedId === item.grocery_id;
    const checkedCount = item.ingredients.filter(ing => ing.checked).length;
    const totalCount = item.ingredients.length;
    const allChecked = checkedCount === totalCount;
    const progress = totalCount > 0 ? checkedCount / totalCount : 0;

    return (
      <View style={styles.recipeCard}>
        {/* Recipe Row — tap to expand */}
        <TouchableOpacity
          style={styles.recipeRow}
          onPress={() => toggleExpand(item.grocery_id)}
          activeOpacity={0.7}
        >
          {/* Left: name */}
          <View style={styles.recipeLeft}>
            <View>
              <Text style={styles.recipeName}>{item.recipe_name}</Text>
              <Text style={styles.recipeCount}>
                {checkedCount}/{totalCount} items
              </Text>
            </View>
          </View>

          {/* Right: progress pill + chevron + delete */}
          <View style={styles.recipeRight}>
            <View style={styles.progressPill}>
              <View
                style={[
                  styles.progressPillFill,
                  { width: `${progress * 100}%` },
                  allChecked && styles.progressPillDone,
                ]}
              />
            </View>
            <Feather
              name={isExpanded ? "chevron-up" : "chevron-down"}
              size={18}
              color="#aaa"
              style={{ marginHorizontal: 6 }}
            />
            <TouchableOpacity
              onPress={() => confirmDeleteItem(item.grocery_id, item.recipe_name)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Feather name="trash-2" size={16} color="#ef4444" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        {/* Expanded ingredient list */}
        {isExpanded && (
          <View style={styles.ingredientList}>
            <View style={styles.divider} />
            {item.ingredients.map((ingredient, idx) => (
              <TouchableOpacity
                key={idx}
                style={styles.ingredientRow}
                onPress={() => toggleIngredient(item.grocery_id, idx)}
                activeOpacity={0.6}
              >
                <View style={[styles.checkbox, ingredient.checked && styles.checkboxChecked]}>
                  {ingredient.checked && <Feather name="check" size={13} color="#fff" />}
                </View>
                <Text style={[styles.ingredientName, ingredient.checked && styles.ingredientDone]}>
                  {ingredient.name}
                </Text>
                {ingredient.quantity ? (
                  <Text style={[styles.quantity, ingredient.checked && styles.quantityDone]}>
                    {ingredient.quantity}
                  </Text>
                ) : null}
              </TouchableOpacity>
            ))}

            {allChecked && (
              <View style={styles.doneBadge}>
                <Feather name="check-circle" size={14} color="#16a34a" />
                <Text style={styles.doneText}>All items collected!</Text>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#16a34a" />
          <Text style={styles.loadingText}>Loading grocery list...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Grocery List</Text>
          <Text style={styles.subtitle}>
            {groceryList.length} recipe{groceryList.length !== 1 ? "s" : ""}
          </Text>
        </View>
        {groceryList.length > 0 && (
          <TouchableOpacity style={styles.clearBtn} onPress={clearAll}>
            <Feather name="trash-2" size={18} color="#ef4444" />
          </TouchableOpacity>
        )}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {groceryList.length > 0 ? (
          groceryList.map(item => (
            <RecipeRow key={item.grocery_id} item={item} />
          ))
        ) : (
          <View style={styles.empty}>
            <Feather name="shopping-cart" size={70} color="#d1fae5" />
            <Text style={styles.emptyTitle}>Your list is empty</Text>
            <Text style={styles.emptySubtitle}>
              Add ingredients from a recipe to get started
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
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: "#666",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 18,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e5f7ed",
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#1a2e1a",
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13,
    color: "#86a892",
    marginTop: 2,
  },
  clearBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#fee2e2",
    justifyContent: "center",
    alignItems: "center",
  },
  scroll: {
    padding: 16,
  },

  // Recipe card
  recipeCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: "#16a34a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 8,
    elevation: 3,
  },
  recipeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  recipeLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 12,
  },
  recipeIconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#dcfce7",
    justifyContent: "center",
    alignItems: "center",
  },
  recipeIconBoxDone: {
    backgroundColor: "#16a34a",
  },
  recipeName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1a2e1a",
    marginBottom: 2,
  },
  recipeCount: {
    fontSize: 12,
    color: "#86a892",
  },
  recipeRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  progressPill: {
    width: 40,
    height: 6,
    backgroundColor: "#e5e7eb",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressPillFill: {
    height: "100%",
    backgroundColor: "#16a34a",
    borderRadius: 3,
  },
  progressPillDone: {
    backgroundColor: "#16a34a",
  },

  // Divider
  divider: {
    height: 1,
    backgroundColor: "#f0fdf4",
    marginHorizontal: 16,
    marginBottom: 4,
  },

  // Ingredients
  ingredientList: {
    paddingBottom: 8,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f9fafb",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: "#d1d5db",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  checkboxChecked: {
    backgroundColor: "#16a34a",
    borderColor: "#16a34a",
  },
  ingredientName: {
    flex: 1,
    fontSize: 15,
    color: "#374151",
  },
  ingredientDone: {
    color: "#9ca3af",
    textDecorationLine: "line-through",
  },
  quantity: {
    fontSize: 14,
    fontWeight: "700",
    color: "#16a34a",
    marginLeft: 8,
  },
  quantityDone: {
    color: "#9ca3af",
    textDecorationLine: "line-through",
  },
  doneBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    margin: 12,
    padding: 10,
    backgroundColor: "#f0fdf4",
    borderRadius: 8,
  },
  doneText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#16a34a",
  },

  // Empty state
  empty: {
    alignItems: "center",
    paddingTop: 100,
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#2C3E50",
    marginTop: 20,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: "#95A5A6",
    textAlign: "center",
    lineHeight: 20,
  },
});