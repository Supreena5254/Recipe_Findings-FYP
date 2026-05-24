import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, FlatList, Modal, Alert, ActivityIndicator,
  SafeAreaView, StatusBar, Image, Platform,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import api from "../api/api";
import { getMinioBaseUrl, buildImageUrl as buildUrl } from "../utils/imageUrl";

// ─── COLORS ──────────────────────────────────────────────
const C = {
  green: "#16a34a",
  greenDark: "#15803d",
  greenLight: "#f0fdf4",
  greenBorder: "#bbf7d0",
  greenMid: "#86efac",
  bg: "#f0fdf4",       // ✅ restored light green background
  white: "#ffffff",
  gray: "#94a3b8",
  grayLight: "#dcfce7",
  border: "#d1fae5",   // ✅ green-tinted border like original
  red: "#dc2626",
  redLight: "#fef2f2",
  redBorder: "#fecaca",
  text: "#0f172a",
  textSub: "#64748b",
  yellow: "#d97706",
  yellowLight: "#fffbeb",
  card: "#ffffff",
  blue: "#2563eb",
  blueLight: "#eff6ff",
  blueBorder: "#bfdbfe",
  purple: "#7c3aed",
  purpleLight: "#f5f3ff",
};

// ─── HELPERS ─────────────────────────────────────────────
// useImageUrl: resolves a stored imageUrl value to a full HTTP URL.
// Handles all 3 formats stored in DB:
//   "152.jpg"           → recipe-152.jpg  (old numeric)
//   "recipe-uuid.jpg"   → recipe-uuid.jpg (new uuid, already prefixed)
//   "http://old-ip/..."  → strips old IP, applies prefix logic above
// Uses your imageUrl.js util which caches the MinIO base URL.
const useImageUrl = (imageUrl) => {
  const [resolvedUrl, setResolvedUrl] = React.useState(null);
  React.useEffect(() => {
    if (!imageUrl) { setResolvedUrl(null); return; }
    getMinioBaseUrl().then(base => {
      setResolvedUrl(buildUrl(base, imageUrl));
    });
  }, [imageUrl]);
  return resolvedUrl;
};

// Sync version for cases where we already have the base URL cached
// (first call may return null until resolved)
let _cachedBase = null;
getMinioBaseUrl().then(b => { _cachedBase = b; });
const buildImageUrl = (imageUrl) => {
  if (!imageUrl || !_cachedBase) return null;
  return buildUrl(_cachedBase, imageUrl);
};

const difficulties = ["Beginner", "Intermediate", "Advanced"];
const mealTypes = ["Breakfast", "Lunch", "Dinner", "Snack", "Dessert", "Drinks"];
const dietPrefs = ["Veg", "Non-Veg", "Vegan"];
const cuisines = ["Nepali", "Indian", "Chinese", "Italian", "Continental", "International", "Other"];

const diffColor = {
  Beginner:     { text: C.green,  bg: C.greenLight,  border: C.greenBorder },
  Intermediate: { text: C.yellow, bg: C.yellowLight,  border: "#fde68a" },
  Advanced:     { text: C.red,    bg: C.redLight,    border: C.redBorder },
};

const EMPTY_RECIPE = {
  title: "", description: "", ingredients: "", quantity: "",
  instructions: "", cooking_time: "30", difficulty_level: "Beginner",
  dietary_preference: "Veg", cuisine_type: "Nepali", meal_type: "Lunch",
  calories: "0", protein: "0", carbs: "0", fats: "0",
  allergens: "", image_url: "", servings: "2",
};

const formatDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }) : "—";

// ─── BADGE ───────────────────────────────────────────────
function Badge({ label, color }) {
  const dc = diffColor[label];
  if (dc) {
    return (
      <View style={[styles.badge, { backgroundColor: dc.bg, borderColor: dc.border }]}>
        <Text style={[styles.badgeText, { color: dc.text }]}>{label}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.badge, { backgroundColor: (color || C.gray) + "18", borderColor: (color || C.gray) + "40" }]}>
      <Text style={[styles.badgeText, { color: color || C.gray }]}>{label}</Text>
    </View>
  );
}

// ─── STAT CARD ───────────────────────────────────────────
function StatCard({ label, value, color, icon, onPress }) {
  return (
    <TouchableOpacity
      style={styles.statCard}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={[styles.statIconWrap, { backgroundColor: color + "15" }]}>
        <Feather name={icon} size={18} color={color} />
      </View>
      <Text style={[styles.statValue, { color }]}>{value ?? "—"}</Text>
      <Text style={styles.statLabel}>{label}</Text>
      {onPress && (
        <Text style={[styles.statTap, { color }]}>View all</Text>
      )}
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
              <Feather name="x" size={20} color={C.gray} />
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
              {selected === opt && <Feather name="check" size={16} color={C.green} />}
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
        <Feather name="chevron-down" size={15} color={C.gray} />
      </TouchableOpacity>
      <PickerModal
        visible={open} title={label} options={options}
        selected={value} onSelect={onChange} onClose={() => setOpen(false)}
      />
    </View>
  );
}

// ─── IMAGE UPLOAD FIELD ──────────────────────────────────
function ImageUploadField({ imageUrl, onImageUploaded }) {
  const [uploading, setUploading] = useState(false);
  const [localUri, setLocalUri] = useState(null);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Please allow access to your photo library.");
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
        uri: asset.uri,
        name: asset.fileName || `photo_${Date.now()}.jpg`,
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
    } catch (err) {
      Alert.alert("Upload Failed", err.message);
      setLocalUri(null);
    } finally {
      setUploading(false);
    }
  };

  // ✅ Use async hook so old numeric filenames (152.jpg → recipe-152.jpg) resolve correctly
  const resolvedImageUrl = useImageUrl(imageUrl);
  const previewUri = localUri || resolvedImageUrl;

  return (
    <View style={styles.formField}>
      <Text style={styles.formLabel}>Recipe Image</Text>
      {previewUri ? (
        <Image source={{ uri: previewUri }} style={styles.imagePreview} resizeMode="cover" />
      ) : (
        <View style={styles.imagePlaceholder}>
          <Feather name="image" size={28} color={C.gray} />
          <Text style={styles.imagePlaceholderText}>No image selected</Text>
        </View>
      )}
      <TouchableOpacity
        style={[styles.uploadBtn, uploading && styles.uploadBtnDisabled]}
        onPress={pickImage} disabled={uploading} activeOpacity={0.8}
      >
        {uploading ? (
          <ActivityIndicator color={C.white} size="small" />
        ) : (
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Feather name="camera" size={16} color={C.white} />
            <Text style={styles.uploadBtnText}>{imageUrl ? "Change Image" : "Upload Image"}</Text>
          </View>
        )}
      </TouchableOpacity>
      {imageUrl ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 }}>
          <Feather name="check-circle" size={13} color={C.green} />
          <Text style={styles.imageFilename} numberOfLines={1}>{imageUrl}</Text>
        </View>
      ) : null}
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
        multiline={multiline} keyboardType={keyboardType}
        autoCapitalize="none"
        placeholderTextColor={C.gray}
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
        calories: String(recipe.calories || 0),
        protein: String(recipe.protein || 0),
        carbs: String(recipe.carbs || 0),
        fats: String(recipe.fats || 0),
        servings: String(recipe.servings || 2),
      });
    } else {
      setForm(EMPTY_RECIPE);
    }
  }, [recipe, visible]);

  const set = useCallback((k) => (v) => setForm(f => ({ ...f, [k]: v })), []);

  const handleSave = async () => {
    if (!form.title.trim() || !form.ingredients.trim() || !form.instructions.trim()) {
      Alert.alert("Required Fields", "Title, ingredients, and instructions are required.");
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
          <Text style={styles.modalTitle}>{recipe ? "Edit Recipe" : "New Recipe"}</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }} activeOpacity={0.7}>
            <Feather name="x" size={22} color={C.textSub} />
          </TouchableOpacity>
        </View>
        <ScrollView
          style={{ flex: 1 }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 20 }}
        >
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
            {saving
              ? <ActivityIndicator color={C.white} />
              : <Text style={styles.btnSaveText}>Save Recipe</Text>
            }
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

// ─── USERS MODAL ─────────────────────────────────────────
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

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Users</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={22} color={C.textSub} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={C.blue} />
          </View>
        ) : (
          <FlatList
            data={users}
            keyExtractor={u => String(u.id)}
            contentContainerStyle={{ padding: 14, paddingBottom: 24 }}
            ListHeaderComponent={
              <Text style={styles.listHeader}>{users.length} registered users</Text>
            }
            ListEmptyComponent={<Text style={styles.emptyText}>No users found</Text>}
            renderItem={({ item: u }) => (
              <View style={styles.userCard}>
                <View style={[styles.avatar, { backgroundColor: C.blue + "18" }]}>
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
                  <View style={{ flexDirection: "row", gap: 12, marginTop: 4, alignItems: "center" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Feather name="calendar" size={11} color={C.gray} />
                      <Text style={styles.userCardMeta}>{formatDate(u.created_at)}</Text>
                    </View>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Feather
                        name={u.email_verified ? "check-circle" : "alert-circle"}
                        size={11}
                        color={u.email_verified ? C.green : C.yellow}
                      />
                      <Text style={[styles.userCardMeta, { color: u.email_verified ? C.green : C.yellow }]}>
                        {u.email_verified ? "Verified" : "Unverified"}
                      </Text>
                    </View>
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

// ─── RATINGS MODAL ───────────────────────────────────────
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

  const renderStars = (rating) => {
    const full = Math.round(rating);
    return "★".repeat(full) + "☆".repeat(5 - full);
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet">
      <SafeAreaView style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>Ratings</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={22} color={C.textSub} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={C.yellow} />
          </View>
        ) : (
          <FlatList
            data={ratings}
            keyExtractor={r => String(r.rating_id || r.id)}
            contentContainerStyle={{ padding: 14, paddingBottom: 24 }}
            ListHeaderComponent={
              <Text style={styles.listHeader}>{ratings.length} total ratings</Text>
            }
            ListEmptyComponent={<Text style={styles.emptyText}>No ratings yet</Text>}
            renderItem={({ item: r }) => (
              <View style={styles.ratingCard}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.ratingRecipeName} numberOfLines={1}>
                      {r.recipe_title || `Recipe #${r.recipe_id}`}
                    </Text>
                    <Text style={styles.ratingUser}>{r.user_name || r.username || `User #${r.user_id}`}</Text>
                  </View>
                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingScore}>{Number(r.rating).toFixed(1)}</Text>
                  </View>
                </View>
                <Text style={[styles.ratingStars, { color: C.yellow }]}>
                  {renderStars(r.rating)}
                </Text>
                {r.review ? (
                  <Text style={styles.ratingReview} numberOfLines={2}>"{r.review}"</Text>
                ) : null}
                <Text style={styles.ratingDate}>{formatDate(r.created_at)}</Text>
              </View>
            )}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

// ─── RECIPES OVERVIEW MODAL (from dashboard tap) ─────────
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
          <Text style={styles.modalTitle}>All Recipes</Text>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Feather name="x" size={22} color={C.textSub} />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={C.green} />
          </View>
        ) : (
          <FlatList
            data={recipes}
            keyExtractor={r => String(r.recipe_id)}
            contentContainerStyle={{ padding: 14, paddingBottom: 24 }}
            ListHeaderComponent={
              <Text style={styles.listHeader}>{recipes.length} recipes</Text>
            }
            ListEmptyComponent={<Text style={styles.emptyText}>No recipes found</Text>}
            renderItem={({ item: r }) => (
              <View style={styles.recipeCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.recipeCardTitle} numberOfLines={1}>{r.title}</Text>
                  <Text style={styles.recipeCardSub}>{r.cuisine_type} · {r.meal_type}</Text>
                  <View style={styles.recipeCardMeta}>
                    <Badge label={r.difficulty_level} color={diffColor[r.difficulty_level]?.text || C.gray} />
                    <Text style={styles.recipeCardCal}>{r.calories} cal</Text>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                      <Feather name="star" size={11} color={C.yellow} />
                      <Text style={styles.rating}>{Number(r.rating || 0).toFixed(1)}</Text>
                    </View>
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
      </View>
    );
  }

  return (
    <>
      <ScrollView style={styles.pageContent} showsVerticalScrollIndicator={false}>
        {/* STAT CARDS */}
        <View style={styles.statRow}>
          <StatCard
            icon="book-open" label="Recipes" value={stats?.totalRecipes}
            color={C.green} onPress={() => setShowRecipesModal(true)}
          />
          <StatCard
            icon="users" label="Users" value={stats?.totalUsers}
            color={C.blue} onPress={() => setShowUsersModal(true)}
          />
          <StatCard
            icon="star" label="Ratings" value={stats?.totalRatings}
            color={C.yellow} onPress={() => setShowRatingsModal(true)}
          />
        </View>

        {/* RECENT RECIPES */}
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
                <Badge label={r.difficulty_level} color={diffColor[r.difficulty_level]?.text || C.gray} />
                <View style={{ flexDirection: "row", alignItems: "center", gap: 3, marginLeft: 8 }}>
                  <Feather name="star" size={11} color={C.yellow} />
                  <Text style={styles.rating}>{Number(r.rating || 0).toFixed(1)}</Text>
                </View>
              </View>
            ))
          )}
          <TouchableOpacity style={styles.viewAllBtn} onPress={() => setShowRecipesModal(true)} activeOpacity={0.7}>
            <Text style={styles.viewAllText}>View all recipes</Text>
            <Feather name="arrow-right" size={14} color={C.green} />
          </TouchableOpacity>
        </View>
      </ScrollView>

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
    Alert.alert("Created", `"${form.title}" has been added.`);
  };

  const handleUpdate = async (form) => {
    await api.put(`/admin/recipes/${form.recipe_id}`, form);
    load();
    Alert.alert("Updated", `"${form.title}" has been updated.`);
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
        <View style={styles.searchInputWrap}>
          <Feather name="search" size={15} color={C.gray} style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search recipes..."
            placeholderTextColor={C.gray}
            value={search}
            onChangeText={setSearch}
          />
        </View>
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => { setEditRecipe(null); setShowForm(true); }}
          activeOpacity={0.8}
        >
          <Feather name="plus" size={16} color={C.white} />
          <Text style={styles.addBtnText}>New</Text>
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
              {/* Thumbnail if image exists */}
              {r.image_url ? (
                <Image
                  source={{ uri: buildImageUrl(r.image_url) }}
                  style={styles.recipeThumbnail}
                  resizeMode="cover"
                />
              ) : (
                <View style={[styles.recipeThumbnail, styles.recipeThumbnailEmpty]}>
                  <Feather name="image" size={18} color={C.gray} />
                </View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={styles.recipeCardTitle} numberOfLines={1}>{r.title}</Text>
                <Text style={styles.recipeCardSub}>{r.cuisine_type} · {r.meal_type}</Text>
                <View style={styles.recipeCardMeta}>
                  <Badge label={r.difficulty_level} color={diffColor[r.difficulty_level]?.text || C.gray} />
                  <Text style={styles.recipeCardCal}>{r.calories} cal</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                    <Feather name="star" size={11} color={C.yellow} />
                    <Text style={styles.rating}>{Number(r.rating || 0).toFixed(1)}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.recipeCardActions}>
                <TouchableOpacity
                  style={styles.editBtn}
                  activeOpacity={0.7}
                  onPress={async () => {
                    try {
                      const res = await api.get(`/admin/recipes/${r.recipe_id}`);
                      setEditRecipe(res.data);
                      setShowForm(true);
                    } catch {
                      Alert.alert("Error", "Could not load recipe details.");
                    }
                  }}
                >
                  <Feather name="edit-2" size={13} color={C.green} />
                  <Text style={styles.editBtnText}>Edit</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteBtn}
                  activeOpacity={0.7}
                  onPress={() => handleDelete(r)}
                >
                  <Feather name="trash-2" size={13} color={C.red} />
                  <Text style={styles.deleteBtnText}>Delete</Text>
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

      {/* TOP BAR */}
      <View style={styles.topBar}>
        <View style={styles.topBarLeft}>
          <MaterialCommunityIcons name="chef-hat" size={32} color={C.green} />
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

      {/* TAB BAR */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabItem, page === "dashboard" && styles.tabItemActive]}
          onPress={() => setPage("dashboard")}
          activeOpacity={0.7}
        >
          <Feather name="bar-chart-2" size={20} color={page === "dashboard" ? C.green : C.gray} />
          <Text style={[styles.tabLabel, page === "dashboard" && styles.tabLabelActive]}>Dashboard</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabItem, page === "recipes" && styles.tabItemActive]}
          onPress={() => setPage("recipes")}
          activeOpacity={0.7}
        >
          <Feather name="book-open" size={20} color={page === "recipes" ? C.green : C.gray} />
          <Text style={[styles.tabLabel, page === "recipes" && styles.tabLabelActive]}>Recipes</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ─── STYLES ──────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  // TOP BAR
  topBar: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: C.white, paddingHorizontal: 16, paddingVertical: 11,
    borderBottomWidth: 1, borderBottomColor: C.border,
    elevation: 2, shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 4,
  },
  topBarLeft: { flexDirection: "row", alignItems: "center", gap: 10 },

  topBarTitle: { fontSize: 16, fontWeight: "700", color: C.text, letterSpacing: -0.2 },
  logoutBtn: {
    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: C.redBorder, backgroundColor: C.redLight,
  },
  logoutBtnText: { color: C.red, fontWeight: "600", fontSize: 13 },

  // TAB BAR
  tabBar: {
    flexDirection: "row", backgroundColor: C.white,
    borderTopWidth: 1, borderTopColor: C.border,
    paddingBottom: Platform.OS === "ios" ? 16 : 6, paddingTop: 6,
  },
  tabItem: { flex: 1, alignItems: "center", paddingVertical: 4 },
  tabItemActive: {},
  tabLabel: { fontSize: 11, color: C.gray, marginTop: 3 },
  tabLabelActive: { color: C.green, fontWeight: "700" },

  // LAYOUT
  pageContent: { flex: 1, padding: 14 },
  centered: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { textAlign: "center", color: C.gray, paddingVertical: 24, fontSize: 14 },
  countText: { paddingHorizontal: 14, paddingTop: 8, paddingBottom: 2, fontSize: 12, color: C.gray },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 14 },
  listHeader: { fontSize: 12, color: C.gray, fontWeight: "600", marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },

  // STAT CARDS
  statRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statCard: {
    flex: 1, backgroundColor: C.card, borderRadius: 14, padding: 14,
    alignItems: "center", borderWidth: 1, borderColor: C.border,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  statIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
  statValue: { fontSize: 22, fontWeight: "800" },
  statLabel: { fontSize: 11, color: C.gray, marginTop: 2 },
  statTap: { fontSize: 10, marginTop: 6, fontWeight: "600" },

  // DASHBOARD SECTION
  section: {
    backgroundColor: C.card, borderRadius: 14, borderWidth: 1,
    borderColor: C.border, overflow: "hidden", marginBottom: 16,
    shadowColor: "#000", shadowOpacity: 0.04, shadowRadius: 6, elevation: 1,
  },
  sectionTitle: {
    fontSize: 13, fontWeight: "700", color: C.text,
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
    textTransform: "uppercase", letterSpacing: 0.5,
  },
  recipeRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  recipeTitle: { fontSize: 13, fontWeight: "600", color: C.text },
  recipeSub: { fontSize: 11, color: C.gray, marginTop: 2 },
  rating: { fontSize: 12, color: C.textSub },
  viewAllBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    padding: 14, gap: 6,
  },
  viewAllText: { fontSize: 13, color: C.green, fontWeight: "600" },

  // BADGE
  badge: {
    paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: 6, borderWidth: 1,
  },
  badgeText: { fontSize: 11, fontWeight: "700" },

  // SEARCH BAR
  searchBar: {
    flexDirection: "row", gap: 10, padding: 12,
    backgroundColor: C.white, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  searchInputWrap: {
    flex: 1, flexDirection: "row", alignItems: "center",
    backgroundColor: C.bg, borderRadius: 10,
    paddingHorizontal: 12, borderWidth: 1, borderColor: C.border,
  },
  searchInput: {
    flex: 1, paddingVertical: 9, fontSize: 14, color: C.text,
  },
  addBtn: {
    backgroundColor: C.green, borderRadius: 10,
    paddingHorizontal: 14, flexDirection: "row",
    alignItems: "center", gap: 6,
  },
  addBtnText: { color: C.white, fontWeight: "700", fontSize: 14 },

  // RECIPE CARDS
  recipeCard: {
    backgroundColor: C.card, borderRadius: 12, borderWidth: 1,
    borderColor: C.border, padding: 12, marginBottom: 10,
    flexDirection: "row", alignItems: "center", gap: 10,
    shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  recipeThumbnail: {
    width: 54, height: 54, borderRadius: 10, backgroundColor: C.grayLight,
  },
  recipeThumbnailEmpty: {
    alignItems: "center", justifyContent: "center",
  },
  recipeCardTitle: { fontSize: 14, fontWeight: "700", color: C.text },
  recipeCardSub: { fontSize: 12, color: C.gray, marginTop: 1 },
  recipeCardMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6, flexWrap: "wrap" },
  recipeCardCal: { fontSize: 12, color: C.gray },
  recipeCardActions: { gap: 6, alignItems: "flex-end" },
  editBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: C.greenBorder, backgroundColor: C.greenLight,
  },
  editBtnText: { color: C.green, fontWeight: "700", fontSize: 12 },
  deleteBtn: {
    flexDirection: "row", alignItems: "center", gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
    borderWidth: 1, borderColor: C.redBorder, backgroundColor: C.redLight,
  },
  deleteBtnText: { color: C.red, fontWeight: "700", fontSize: 12 },

  // USER CARDS
  userCard: {
    backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    padding: 12, marginBottom: 8, flexDirection: "row", alignItems: "center", gap: 12,
    shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  avatar: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  avatarText: { fontSize: 17, fontWeight: "800" },
  userCardName: { fontSize: 14, fontWeight: "700", color: C.text },
  userCardEmail: { fontSize: 12, color: C.gray, marginTop: 2 },
  userCardMeta: { fontSize: 11, color: C.gray },

  // RATING CARDS
  ratingCard: {
    backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    padding: 12, marginBottom: 8,
    shadowColor: "#000", shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  ratingRecipeName: { fontSize: 14, fontWeight: "700", color: C.text, flex: 1 },
  ratingUser: { fontSize: 12, color: C.gray, marginTop: 2 },
  ratingBadge: {
    backgroundColor: C.yellowLight, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8,
    borderWidth: 1, borderColor: "#fde68a",
  },
  ratingScore: { fontSize: 15, fontWeight: "800", color: C.yellow },
  ratingStars: { fontSize: 15, marginTop: 6, letterSpacing: 2 },
  ratingReview: { fontSize: 12, color: C.textSub, marginTop: 6, fontStyle: "italic" },
  ratingDate: { fontSize: 11, color: C.gray, marginTop: 6 },

  // MODAL
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, backgroundColor: C.white,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: C.text, letterSpacing: -0.2 },
  modalBody: { padding: 16 },
  modalFooter: {
    flexDirection: "row", gap: 10, padding: 16,
    backgroundColor: C.white, borderTopWidth: 1, borderTopColor: C.border,
  },

  // FORM
  formField: { marginBottom: 14 },
  formLabel: {
    fontSize: 11, fontWeight: "700", color: C.textSub,
    marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5,
  },
  formInput: {
    borderWidth: 1.5, borderColor: C.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 14, color: C.text, backgroundColor: C.white,
  },
  formTextarea: { minHeight: 80, textAlignVertical: "top" },
  formRow: { flexDirection: "row", marginBottom: 0 },

  selectBtn: {
    borderWidth: 1.5, borderColor: C.border, borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: C.white,
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
  },
  selectBtnText: { fontSize: 14, color: C.text, fontWeight: "500" },

  pickerOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "flex-end" },
  pickerSheet: {
    backgroundColor: C.white, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: Platform.OS === "ios" ? 30 : 16, overflow: "hidden",
  },
  pickerHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    padding: 16, borderBottomWidth: 1, borderBottomColor: C.border,
  },
  pickerTitle: { fontSize: 15, fontWeight: "700", color: C.text },
  pickerOption: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 20, paddingVertical: 14,
    borderBottomWidth: 1, borderBottomColor: C.grayLight,
  },
  pickerOptionSelected: { backgroundColor: C.greenLight },
  pickerOptionText: { fontSize: 15, color: C.text },
  pickerOptionTextSelected: { color: C.green, fontWeight: "700" },

  // IMAGE UPLOAD
  imagePreview: {
    width: "100%", height: 180, borderRadius: 12,
    marginBottom: 10, backgroundColor: C.border,
  },
  imagePlaceholder: {
    width: "100%", height: 130, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.border, borderStyle: "dashed",
    alignItems: "center", justifyContent: "center",
    backgroundColor: C.grayLight, marginBottom: 10, gap: 8,
  },
  imagePlaceholderText: { color: C.gray, fontSize: 13 },
  uploadBtn: {
    backgroundColor: C.green, borderRadius: 10,
    paddingVertical: 11, alignItems: "center",
  },
  uploadBtnDisabled: { backgroundColor: C.gray },
  uploadBtnText: { color: C.white, fontWeight: "700", fontSize: 14 },
  imageFilename: { fontSize: 12, color: C.green, flex: 1 },

  // BUTTONS
  btnCancel: {
    flex: 1, paddingVertical: 13, borderRadius: 12,
    borderWidth: 1.5, borderColor: C.border, alignItems: "center",
  },
  btnCancelText: { color: C.textSub, fontWeight: "600", fontSize: 15 },
  btnSave: {
    flex: 2, paddingVertical: 13, borderRadius: 12,
    backgroundColor: C.green, alignItems: "center",
  },
  btnSaveDisabled: { backgroundColor: C.greenMid },
  btnSaveText: { color: C.white, fontWeight: "700", fontSize: 15 },
});