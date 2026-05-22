import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, FlatList, Modal, Alert, ActivityIndicator,
  SafeAreaView, StatusBar, Image, Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import api from "../api/api";
import { MaterialCommunityIcons } from "@expo/vector-icons";

// ─── COLORS ──────────────────────────────────────────────
const C = {
  green: "#16a34a",
  greenDark: "#15803d",
  greenLight: "#dcfce7",
  greenMid: "#86efac",
  bg: "#f0fdf4",
  white: "#ffffff",
  gray: "#6b7280",
  grayLight: "#f9fafb",
  border: "#d1fae5",
  red: "#dc2626",
  redLight: "#fee2e2",
  text: "#111827",
  textSub: "#6b7280",
  yellow: "#f59e0b",
  card: "#ffffff",
  blue: "#3b82f6",
  blueLight: "#eff6ff",
  purple: "#7c3aed",
  purpleLight: "#ede9fe",
  orange: "#ea580c",
  orangeLight: "#fff7ed",
};

const difficulties = ["Beginner", "Intermediate", "Advanced"];
const mealTypes = ["Breakfast", "Lunch", "Dinner", "Snack", "Dessert", "Drinks"];
const dietPrefs = ["Veg", "Non-Veg", "Vegan"];
const cuisines = ["Nepali", "Indian", "Chinese", "Italian", "Continental", "International", "Other"];

const diffColor = {
  Beginner: C.green,
  Intermediate: C.yellow,
  Advanced: C.red,
};

const EMPTY_RECIPE = {
  title: "", description: "", ingredients: "", quantity: "",
  instructions: "", cooking_time: "30", difficulty_level: "Beginner",
  dietary_preference: "Veg", cuisine_type: "Nepali", meal_type: "Lunch",
  calories: "0", protein: "0", carbs: "0", fats: "0",
  allergens: "", image_url: "", servings: "2",
};

// ─── BADGE ───────────────────────────────────────────────
function Badge({ label, color }) {
  return (
    <View style={[styles.badge, { backgroundColor: color + "22" }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

// ─── STAT CARD (now tappable) ────────────────────────────
function StatCard({ icon, label, value, color, onPress }) {
  return (
    <TouchableOpacity
      style={[styles.statCard, onPress && styles.statCardTappable]}
      onPress={onPress}
      activeOpacity={onPress ? 0.75 : 1}
    >
      <Text style={styles.statIcon}>{icon}</Text>
      <Text style={[styles.statValue, color && { color }]}>{value ?? "—"}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {onPress && <Text style={[styles.statTap, color && { color }]}>View all →</Text>}
    </TouchableOpacity>
  );
}

// ─── PICKER MODAL ─────────────────────────────────────────
function PickerModal({ visible, options, selected, onSelect, onClose, title }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.pickerOverlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.pickerSheet}>
          <View style={styles.pickerHeader}>
            <Text style={styles.pickerTitle}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.pickerClose}>✕</Text>
            </TouchableOpacity>
          </View>
          {options.map((opt) => (
            <TouchableOpacity
              key={opt}
              style={[styles.pickerOption, selected === opt && styles.pickerOptionSelected]}
              onPress={() => { onSelect(opt); onClose(); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.pickerOptionText, selected === opt && styles.pickerOptionTextSelected]}>
                {opt}
              </Text>
              {selected === opt && <Text style={{ color: C.green }}>✓</Text>}
            </TouchableOpacity>
          ))}
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

// ─── SELECT FIELD ─────────────────────────────────────────
function SelectField({ label, value, options, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <TouchableOpacity style={styles.selectBtn} onPress={() => setOpen(true)} activeOpacity={0.7}>
        <Text style={styles.selectBtnText}>{value}</Text>
        <Text style={styles.selectArrow}>▼</Text>
      </TouchableOpacity>
      <PickerModal
        visible={open} title={label} options={options}
        selected={value} onSelect={onChange} onClose={() => setOpen(false)}
      />
    </View>
  );
}

// ─── IMAGE UPLOAD SECTION ────────────────────────────────
function ImageUploadField({ imageUrl, onImageUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [localUri, setLocalUri] = useState(null);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow access to your photo library to upload images.", [{ text: "OK" }]);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [4, 3], quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setLocalUri(asset.uri);
    await uploadToMinio(asset);
  };

  const uploadToMinio = async (asset) => {
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("image", {
        uri: asset.uri, name: asset.fileName || `photo_${Date.now()}.jpg`,
        type: asset.mimeType || "image/jpeg",
      });
      const token = await AsyncStorage.getItem("authToken");
      const baseUrl = api.defaults.baseURL;
      const res = await fetch(`${baseUrl}/admin/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onImageUploaded(data.imageUrl);
      Alert.alert("✅ Uploaded!", `Image saved: ${data.imageUrl}`);
    } catch (err) {
      console.error("Upload error:", err);
      Alert.alert("Upload Failed", err.message);
      setLocalUri(null);
    } finally {
      setUploading(false);
    }
  };

  const previewUri = localUri || (imageUrl ? `http://YOUR_IP:9000/recipe-images/${imageUrl}` : null);

  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>Recipe Image</Text>
      {previewUri ? (
        <Image source={{ uri: previewUri }} style={styles.imagePreview} resizeMode="cover" />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Text style={styles.imagePlaceholderIcon}>🖼️</Text>
          <Text style={styles.imagePlaceholderText}>No image selected</Text>
        </View>
      )}
      <TouchableOpacity
        style={[styles.uploadBtn, uploading && styles.uploadBtnDisabled]}
        onPress={pickImage} disabled={uploading} activeOpacity={0.8}
      >
        {uploading
          ? <ActivityIndicator color={C.white} size="small" />
          : <Text style={styles.uploadBtnText}>{imageUrl ? "📷  Change Image" : "📷  Upload Image"}</Text>
        }
      </TouchableOpacity>
      {imageUrl ? <Text style={styles.imageFilename}>✅ Saved: {imageUrl}</Text> : null}
    </View>
  );
}

// ─── FORM FIELD ───────────────────────────────────────────
function FormField({ label, value, onChangeText, multiline = false, keyboardType = "default" }) {
  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>{label}</Text>
      <TextInput
        style={[styles.formInput, multiline && styles.formTextarea]}
        value={value || ""} onChangeText={onChangeText}
        multiline={multiline} keyboardType={keyboardType} autoCapitalize="none"
      />
    </View>
  );
}

// ─── RECIPE FORM MODAL ───────────────────────────────────
function RecipeFormModal({ visible, recipe, onClose, onSave }) {
  const [form, setForm] = useState(EMPTY_RECIPE);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (recipe) {
      setForm({
        ...EMPTY_RECIPE, ...recipe,
        cooking_time: String(recipe.cooking_time || 30),
        calories: String(recipe.calories || 0), protein: String(recipe.protein || 0),
        carbs: String(recipe.carbs || 0), fats: String(recipe.fats || 0),
        servings: String(recipe.servings || 2),
      });
    } else {
      setForm(EMPTY_RECIPE);
    }
  }, [recipe, visible]);

  const set = useCallback((k) => (v) => setForm(f => ({ ...f, [k]: v })), []);

  const handleSave = async () => {
    if (!form.title.trim() || !form.ingredients.trim() || !form.instructions.trim()) {
      Alert.alert("Required", "Title, ingredients, and instructions are required.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        ...form,
        cooking_time: parseInt(form.cooking_time) || 30,
        calories: parseInt(form.calories) || 0,
        protein: parseInt(form.protein) || 0,
        carbs: parseInt(form.carbs) || 0,
        fats: parseInt(form.fats) || 0,
        servings: parseInt(form.servings) || 2,
      });
      onClose();
    } catch (err) {
      Alert.alert("Error", err.response?.data?.error || err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>{recipe ? "✏️ Edit Recipe" : "➕ New Recipe"}</Text>          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
          <View style={styles.modalBody}>
            <ImageUploadField imageUrl={form.image_url} onImageUploaded={set("image_url")} />
            <View style={styles.divider} />
            <FormField label="Title *" value={form.title} onChangeText={set("title")} />
            <FormField label="Description" value={form.description} onChangeText={set("description")} multiline />
            <FormField label="Ingredients * (comma-separated)" value={form.ingredients} onChangeText={set("ingredients")} multiline />
            <FormField label="Quantities (comma-separated)" value={form.quantity} onChangeText={set("quantity")} />
            <FormField label="Instructions *" value={form.instructions} onChangeText={set("instructions")} multiline />
            <View style={styles.divider} />
            <View style={styles.formRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <SelectField label="Difficulty" value={form.difficulty_level} options={difficulties} onChange={set("difficulty_level")} />
              </View>
              <View style={{ flex: 1 }}>
                <SelectField label="Meal Type" value={form.meal_type} options={mealTypes} onChange={set("meal_type")} />
              </View>
            </View>
            <View style={styles.formRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <SelectField label="Diet" value={form.dietary_preference} options={dietPrefs} onChange={set("dietary_preference")} />
              </View>
              <View style={{ flex: 1 }}>
                <SelectField label="Cuisine" value={form.cuisine_type} options={cuisines} onChange={set("cuisine_type")} />
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.formRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <FormField label="Cook Time (min)" value={form.cooking_time} onChangeText={set("cooking_time")} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <FormField label="Servings" value={form.servings} onChangeText={set("servings")} keyboardType="numeric" />
              </View>
            </View>
            <View style={styles.formRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <FormField label="Calories" value={form.calories} onChangeText={set("calories")} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <FormField label="Protein (g)" value={form.protein} onChangeText={set("protein")} keyboardType="numeric" />
              </View>
            </View>
            <View style={styles.formRow}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <FormField label="Carbs (g)" value={form.carbs} onChangeText={set("carbs")} keyboardType="numeric" />
              </View>
              <View style={{ flex: 1 }}>
                <FormField label="Fats (g)" value={form.fats} onChangeText={set("fats")} keyboardType="numeric" />
              </View>
            </View>
            <FormField label="Allergens (optional)" value={form.allergens} onChangeText={set("allergens")} />
          </View>
        </ScrollView>
        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.btnCancel} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.btnCancelText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnSave, saving && styles.btnSaveDisabled]}
            onPress={handleSave} disabled={saving} activeOpacity={0.8}
          >
            {saving ? <ActivityIndicator color={C.white} /> : <Text style={styles.btnSaveText}>Save Recipe</Text>}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── USERS DETAIL MODAL ──────────────────────────────────
function UsersModal({ visible, onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    api.get("/admin/users")
      .then(r => setUsers(r.data))
      .catch(err => Alert.alert("Error", err.message))
      .finally(() => setLoading(false));
  }, [visible]);

  const formatDate = (d) => d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={styles.modalHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 22 }}>👥</Text>
            <Text style={styles.modalTitle}>All Users</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={C.blue} />
            <Text style={{ color: C.gray, marginTop: 10 }}>Loading users...</Text>
          </View>
        ) : (
          <FlatList
            data={users}
            keyExtractor={u => String(u.id)}
            contentContainerStyle={{ padding: 14, paddingBottom: 24 }}
            ListHeaderComponent={
              <Text style={styles.listHeader}>{users.length} registered user{users.length !== 1 ? "s" : ""}</Text>
            }
            ListEmptyComponent={<Text style={styles.emptyText}>No users found</Text>}
            renderItem={({ item: u }) => (
              <View style={styles.userCard}>
                {/* Avatar circle */}
                <View style={[styles.avatar, { backgroundColor: C.blue + "22" }]}>
                  <Text style={[styles.avatarText, { color: C.blue }]}>
                    {(u.full_name || u.username || "?")[0].toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <Text style={styles.userCardName}>{u.full_name || u.username}</Text>
                    {u.is_admin && <Badge label="Admin" color={C.purple} />}
                  </View>
                  <Text style={styles.userCardEmail}>{u.email}</Text>
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 4 }}>
                    <Text style={styles.userCardMeta}>📅 Joined {formatDate(u.created_at)}</Text>
                    <Text style={[styles.userCardMeta, { color: u.email_verified ? C.green : C.orange }]}>
                      {u.email_verified ? "✅ Verified" : "⚠️ Unverified"}
                    </Text>
                  </View>
                </View>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ─── RATINGS DETAIL MODAL ────────────────────────────────
function RatingsModal({ visible, onClose }) {
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    api.get("/admin/ratings")
      .then(r => setRatings(r.data))
      .catch(err => Alert.alert("Error", err.message))
      .finally(() => setLoading(false));
  }, [visible]);

  const formatDate = (d) => d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

  const renderStars = (rating) => {
    const full = Math.round(rating);
    return "★".repeat(full) + "☆".repeat(5 - full);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={styles.modalHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 22 }}>⭐</Text>
            <Text style={styles.modalTitle}>All Ratings</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={C.yellow} />
            <Text style={{ color: C.gray, marginTop: 10 }}>Loading ratings...</Text>
          </View>
        ) : (
          <FlatList
            data={ratings}
            keyExtractor={r => String(r.rating_id || r.id)}
            contentContainerStyle={{ padding: 14, paddingBottom: 24 }}
            ListHeaderComponent={
              <Text style={styles.listHeader}>{ratings.length} total rating{ratings.length !== 1 ? "s" : ""}</Text>
            }
            ListEmptyComponent={<Text style={styles.emptyText}>No ratings yet</Text>}
            renderItem={({ item: r }) => (
              <View style={styles.ratingCard}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ratingRecipeName} numberOfLines={1}>
                      🍽️ {r.recipe_title || `Recipe #${r.recipe_id}`}
                    </Text>
                    <Text style={styles.ratingUser}>👤 {r.user_name || r.username || `User #${r.user_id}`}</Text>
                  </View>
                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingScore}>{Number(r.rating).toFixed(1)}</Text>
                  </View>
                </View>
                <Text style={[styles.ratingStars, { color: C.yellow }]}>
                  {renderStars(r.rating)}
                </Text>
                {r.review && (
                  <Text style={styles.ratingReview} numberOfLines={2}>"{r.review}"</Text>
                )}
                <Text style={styles.ratingDate}>{formatDate(r.created_at)}</Text>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ─── RECIPES DETAIL MODAL (all recipes from dashboard tap) ─
function RecipesModal({ visible, onClose }) {
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    api.get("/admin/recipes")
      .then(r => setRecipes(r.data))
      .catch(err => Alert.alert("Error", err.message))
      .finally(() => setLoading(false));
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={styles.modalHeader}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Text style={{ fontSize: 22 }}>🍽️</Text>
            <Text style={styles.modalTitle}>All Recipes</Text>
          </View>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.modalClose}>✕</Text>
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={C.green} />
            <Text style={{ color: C.gray, marginTop: 10 }}>Loading recipes...</Text>
          </View>
        ) : (
          <FlatList
            data={recipes}
            keyExtractor={r => String(r.recipe_id)}
            contentContainerStyle={{ padding: 14, paddingBottom: 24 }}
            ListHeaderComponent={
              <Text style={styles.listHeader}>{recipes.length} total recipe{recipes.length !== 1 ? "s" : ""}</Text>
            }
            ListEmptyComponent={<Text style={styles.emptyText}>No recipes found</Text>}
            renderItem={({ item: r }) => (
              <View style={styles.recipeCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recipeCardTitle} numberOfLines={1}>{r.title}</Text>
                  <Text style={styles.recipeCardSub}>{r.cuisine_type} · {r.meal_type}</Text>
                  <View style={styles.recipeCardMeta}>
                    <Badge label={r.difficulty_level} color={diffColor[r.difficulty_level] || C.gray} />
                    <Text style={styles.recipeCardCal}>{r.calories} cal</Text>
                    <Text style={styles.rating}>⭐ {Number(r.rating || 0).toFixed(1)}</Text>
                    {r.rating_count > 0 && (
                      <Text style={styles.ratingCount}>({r.rating_count})</Text>
                    )}
                  </View>
                </View>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ─── DASHBOARD PAGE ──────────────────────────────────────
function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modal visibility state
  const [showUsersModal, setShowUsersModal] = useState(false);
  const [showRatingsModal, setShowRatingsModal] = useState(false);
  const [showRecipesModal, setShowRecipesModal] = useState(false);

  useEffect(() => {
    Promise.all([
      api.get("/admin/stats"),
      api.get("/admin/recipes"),
    ]).then(([statsRes, recipesRes]) => {
      setStats(statsRes.data);
      setRecipes(recipesRes.data.slice(0, 5));
    }).catch(err => console.error("Dashboard load error:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={C.green} />
        <Text style={{ color: C.gray, marginTop: 10 }}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.pageContent} showsVerticalScrollIndicator={false}>
        {/* ── STAT CARDS (tappable) ── */}
        <View style={styles.statRow}>
          <StatCard
            icon="🍽️" label="Recipes" value={stats?.totalRecipes}
            color={C.green}
            onPress={() => setShowRecipesModal(true)}
          />
          <StatCard
            icon="👤" label="Users" value={stats?.totalUsers}
            color={C.blue}
            onPress={() => setShowUsersModal(true)}
          />
          <StatCard
            icon="⭐" label="Ratings" value={stats?.totalRatings}
            color={C.yellow}
            onPress={() => setShowRatingsModal(true)}
          />
        </View>

        {/* ── RECENT RECIPES ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Recipes</Text>
          {recipes.length === 0 ? (
            <Text style={styles.emptyText}>No recipes yet</Text>
          ) : (
            recipes.map((r) => (
              <View key={r.recipe_id} style={styles.recipeRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recipeTitle} numberOfLines={1}>{r.title}</Text>
                  <Text style={styles.recipeSub}>{r.cuisine_type} · {r.meal_type}</Text>
                </View>
                <Badge label={r.difficulty_level} color={diffColor[r.difficulty_level] || C.gray} />
                <Text style={styles.rating}>⭐ {Number(r.rating || 0).toFixed(1)}</Text>
              </View>
            ))
          )}
          <TouchableOpacity style={styles.viewAllBtn} onPress={() => setShowRecipesModal(true)}>
            <Text style={styles.viewAllText}>View all recipes →</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── DETAIL MODALS ── */}
      <UsersModal visible={showUsersModal} onClose={() => setShowUsersModal(false)} />
      <RatingsModal visible={showRatingsModal} onClose={() => setShowRatingsModal(false)} />
      <RecipesModal visible={showRecipesModal} onClose={() => setShowRecipesModal(false)} />
    </>
  );
}

// ─── RECIPES PAGE ────────────────────────────────────────
function RecipesPage() {
  const [recipes, setRecipes] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editRecipe, setEditRecipe] = useState(null);

  const load = useCallback(() => {
    setLoading(true);
    api.get("/admin/recipes")
      .then(r => setRecipes(r.data))
      .catch(err => Alert.alert("Error", err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = recipes.filter(r =>
    !search || r.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreate = async (form) => {
    await api.post("/admin/recipes", form);
    load();
    Alert.alert("✅ Created", `"${form.title}" has been added.`);
  };

  const handleUpdate = async (form) => {
    await api.put(`/admin/recipes/${form.recipe_id}`, form);
    load();
    Alert.alert("✅ Updated", `"${form.title}" has been updated.`);
  };

  const handleDelete = (recipe) => {
    Alert.alert(
      "Delete Recipe",
      `Delete "${recipe.title}"? This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete", style: "destructive",
          onPress: async () => {
            try {
              await api.delete(`/admin/recipes/${recipe.recipe_id}`);
              load();
            } catch (err) {
              Alert.alert("Error", err.message);
            }
          },
        },
      ]
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="🔍  Search recipes..."
          placeholderTextColor={C.gray}
          value={search}
          onChangeText={setSearch}
        />
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => { setEditRecipe(null); setShowForm(true); }}
          activeOpacity={0.8}
        >
          <Text style={styles.addBtnText}>+ New</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.countText}>{filtered.length} recipe{filtered.length !== 1 ? "s" : ""}</Text>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={C.green} />
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={r => String(r.recipe_id)}
          contentContainerStyle={{ padding: 12, paddingBottom: 20 }}
          ListEmptyComponent={<Text style={styles.emptyText}>No recipes found</Text>}
          renderItem={({ item: r }) => (
            <View style={styles.recipeCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.recipeCardTitle} numberOfLines={1}>{r.title}</Text>
                <Text style={styles.recipeCardSub}>{r.cuisine_type} · {r.meal_type}</Text>
                <View style={styles.recipeCardMeta}>
                  <Badge label={r.difficulty_level} color={diffColor[r.difficulty_level] || C.gray} />
                  <Text style={styles.recipeCardCal}>{r.calories} cal</Text>
                  <Text style={styles.rating}>⭐ {Number(r.rating || 0).toFixed(1)}</Text>
                </View>
              </View>
              <View style={styles.recipeCardActions}>
                <TouchableOpacity
                  style={styles.editBtn}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  activeOpacity={0.7}
                  onPress={async () => {
                    try {
                      const res = await api.get(`/admin/recipes/${r.recipe_id}`);
                      setEditRecipe(res.data);
                      setShowForm(true);
                    } catch (err) {
                      Alert.alert("Error", "Could not load recipe details.");
                    }
                  }}
                >
                  <Text style={styles.editBtnText}>✏️ Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  activeOpacity={0.7}
                  onPress={() => handleDelete(r)}
                >
                  <Text style={styles.deleteBtnText}>🗑️ Delete</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        />
      )}

      <RecipeFormModal
        visible={showForm}
        recipe={editRecipe}
        onClose={() => { setShowForm(false); setEditRecipe(null); }}
        onSave={editRecipe ? handleUpdate : handleCreate}
      />
    </View>
  );
}

// ─── MAIN ADMIN PANEL ────────────────────────────────────
export default function Adminpanel({ navigation }) {
  const [page, setPage] = useState("dashboard");

  const handleLogout = async () => {
    Alert.alert("Logout", "Are you sure you want to logout?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Logout", style: "destructive",
        onPress: async () => {
          await AsyncStorage.multiRemove([
            "authToken", "authUser", "userId",
            "userEmail", "preferences_completed",
          ]);
          navigation.reset({ index: 0, routes: [{ name: "Login" }] });
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={C.white} />
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <MaterialCommunityIcons name="chef-hat" size={28} color="#16a34a" />
          <Text style={styles.topBarTitle}>CookMate Admin</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.logoutBtnText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1 }}>
        {page === "dashboard" && <DashboardPage />}
        {page === "recipes" && <RecipesPage />}
      </View>

      <View style={styles.tabBar}>
        <TouchableOpacity style={styles.tabItem} onPress={() => setPage("dashboard")} activeOpacity={0.7}>
          <Text style={[styles.tabIcon, page === "dashboard" && styles.tabIconActive]}>📊</Text>
          <Text style={[styles.tabLabel, page === "dashboard" && styles.tabLabelActive]}>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.tabItem} onPress={() => setPage("recipes")} activeOpacity={0.7}>
          <Text style={[styles.tabIcon, page === "recipes" && styles.tabIconActive]}>🍽️</Text>
          <Text style={[styles.tabLabel, page === "recipes" && styles.tabLabelActive]}>Recipes</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── STYLES ──────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: C.white, paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
    elevation: 2, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4,
  },
  topBarLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  topBarIcon: { fontSize: 22 },
  topBarTitle: { fontSize: 18, fontWeight: "700", color: C.green },

  logoutBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1.5, borderColor: C.red },
  logoutBtnText: { color: C.red, fontWeight: "600", fontSize: 13 },

  tabBar: {
    flexDirection: "row", backgroundColor: C.white,
    borderTopWidth: 1, borderTopColor: C.border,
    paddingBottom: Platform.OS === "ios" ? 16 : 8, paddingTop: 8,
  },
  tabItem: { flex: 1, alignItems: "center" },
  tabIcon: { fontSize: 22, opacity: 0.4 },
  tabIconActive: { opacity: 1 },
  tabLabel: { fontSize: 11, color: C.gray, marginTop: 2 },
  tabLabelActive: { color: C.green, fontWeight: "700" },

  pageContent: { flex: 1, padding: 16 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { textAlign: "center", color: C.gray, paddingVertical: 24, fontSize: 14 },
  countText: { paddingHorizontal: 16, paddingTop: 8, fontSize: 12, color: C.gray },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 14 },
  listHeader: { fontSize: 13, color: C.gray, fontWeight: "600", marginBottom: 10 },

  // Stat cards
  statRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 14,
    alignItems: "center", borderWidth: 1, borderColor: C.border,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  statCardTappable: {
    borderWidth: 1.5,
    shadowOpacity: 0.08, elevation: 3,
  },
  statIcon: { fontSize: 24, marginBottom: 4 },
  statValue: { fontSize: 22, fontWeight: "800", color: C.green },
  statLabel: { fontSize: 11, color: C.gray, marginTop: 2 },
  statTap: { fontSize: 10, color: C.green, marginTop: 6, fontWeight: "600" },

  // Dashboard section
  section: {
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1,
    borderColor: C.border, overflow: "hidden", marginBottom: 16,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: C.text, padding: 14, borderBottomWidth: 1, borderBottomColor: C.border },
  recipeRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  recipeTitle: { fontSize: 13, fontWeight: "600", color: C.text },
  recipeSub: { fontSize: 11, color: C.gray, marginTop: 2 },
  rating: { fontSize: 12, color: C.gray, marginLeft: 4 },
  ratingCount: { fontSize: 11, color: C.gray },
  viewAllBtn: { padding: 14, alignItems: "center" },
  viewAllText: { fontSize: 13, color: C.green, fontWeight: "700" },

  // Badge
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 99 },
  badgeText: { fontSize: 11, fontWeight: "700" },

  // Search bar
  searchBar: {
    flexDirection: "row", gap: 10, padding: 12,
    backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  searchInput: {
    flex: 1, backgroundColor: C.bg, borderRadius: 10, paddingHorizontal: 12,
    paddingVertical: 9, fontSize: 14, color: C.text, borderWidth: 1, borderColor: C.border,
  },
  addBtn: { backgroundColor: C.green, borderRadius: 10, paddingHorizontal: 18, justifyContent: "center" },
  addBtnText: { color: C.white, fontWeight: "700", fontSize: 14 },

  // Recipe cards
  recipeCard: {
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1,
    borderColor: C.border, padding: 14, marginBottom: 10,
    flexDirection: "row", alignItems: "flex-start", gap: 10,
    shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  recipeCardTitle: { fontSize: 14, fontWeight: "700", color: C.text },
  recipeCardSub: { fontSize: 12, color: C.gray, marginTop: 2 },
  recipeCardMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" },
  recipeCardCal: { fontSize: 12, color: C.gray },
  recipeCardActions: { gap: 8, alignItems: "flex-end" },
  editBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1.5, borderColor: C.green, backgroundColor: C.greenLight,
  },
  editBtnText: { color: C.green, fontWeight: "700", fontSize: 12 },
  deleteBtn: {
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
    borderWidth: 1.5, borderColor: C.red, backgroundColor: C.redLight,
  },
  deleteBtnText: { color: C.red, fontWeight: "700", fontSize: 12 },

  // User cards
  userCard: {
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 10, flexDirection: "row", alignItems: "center", gap: 12,
    shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  avatar: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 18, fontWeight: "800" },
  userCardName: { fontSize: 14, fontWeight: "700", color: C.text },
  userCardEmail: { fontSize: 12, color: C.gray, marginTop: 2 },
  userCardMeta: { fontSize: 11, color: C.gray, marginTop: 2 },

  // Rating cards
  ratingCard: {
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border,
    padding: 14, marginBottom: 10,
    shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  ratingRecipeName: { fontSize: 14, fontWeight: "700", color: C.text, flex: 1 },
  ratingUser: { fontSize: 12, color: C.gray, marginTop: 2 },
  ratingBadge: {
    backgroundColor: C.yellow + "22", borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8,
  },
  ratingScore: { fontSize: 16, fontWeight: "800", color: C.yellow },
  ratingStars: { fontSize: 16, marginTop: 6, letterSpacing: 2 },
  ratingReview: { fontSize: 12, color: C.textSub, marginTop: 6, fontStyle: "italic" },
  ratingDate: { fontSize: 11, color: C.gray, marginTop: 6 },

  // Modal
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: C.text },
  modalClose: { fontSize: 20, color: C.gray, padding: 4 },
  modalBody: { padding: 16 },
  modalFooter: {
    flexDirection: "row", gap: 10, padding: 16,
    backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border,
  },

  // Form
  formField: { marginBottom: 14 },
  formLabel: { fontSize: 12, fontWeight: "700", color: C.gray, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.3 },
  formInput: { borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: C.text, backgroundColor: C.white },
  formTextarea: { minHeight: 80, textAlignVertical: "top" },
  formRow: { flexDirection: "row", marginBottom: 0 },

  selectBtn: { borderWidth: 1.5, borderColor: C.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.white, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  selectBtnText: { fontSize: 14, color: C.text, fontWeight: "500" },
  selectArrow: { fontSize: 11, color: C.gray },

  pickerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  pickerSheet: { backgroundColor: C.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: Platform.OS === "ios" ? 30 : 16, overflow: "hidden" },
  pickerHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  pickerTitle: { fontSize: 15, fontWeight: "700", color: C.text },
  pickerClose: { fontSize: 18, color: C.gray },
  pickerOption: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
  pickerOptionSelected: { backgroundColor: C.greenLight },
  pickerOptionText: { fontSize: 15, color: C.text },
  pickerOptionTextSelected: { color: C.green, fontWeight: "700" },

  imagePreview: { width: "100%", height: 180, borderRadius: 12, marginBottom: 10, backgroundColor: C.border },
  imagePlaceholder: { width: "100%", height: 140, borderRadius: 12, borderWidth: 2, borderColor: C.border, borderStyle: "dashed", alignItems: "center", justifyContent: "center", backgroundColor: C.grayLight, marginBottom: 10 },
  imagePlaceholderIcon: { fontSize: 36, marginBottom: 6 },
  imagePlaceholderText: { color: C.gray, fontSize: 13 },
  uploadBtn: { backgroundColor: C.blue, borderRadius: 10, paddingVertical: 11, alignItems: "center" },
  uploadBtnDisabled: { backgroundColor: C.gray },
  uploadBtnText: { color: C.white, fontWeight: "700", fontSize: 14 },
  imageFilename: { marginTop: 8, fontSize: 12, color: C.green, textAlign: "center" },

  btnCancel: { flex: 1, paddingVertical: 13, borderRadius: 12, borderWidth: 1.5, borderColor: C.gray, alignItems: "center" },
  btnCancelText: { color: C.gray, fontWeight: "600", fontSize: 15 },
  btnSave: { flex: 2, paddingVertical: 13, borderRadius: 12, backgroundColor: C.green, alignItems: "center" },
  btnSaveDisabled: { backgroundColor: C.greenMid },
  btnSaveText: { color: C.white, fontWeight: "700", fontSize: 15 },
});