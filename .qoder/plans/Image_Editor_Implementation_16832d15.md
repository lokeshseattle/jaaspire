# Image Editor Implementation Plan

## Overview
Implement a full-featured image editor in `post-image-editor.tsx` that allows users to apply filters and adjustments to images before posting. The editor will be accessed from `create.tsx` after selecting an image.

---

## 1. File Structure

### New Files to Create:
1. **`/app/(app)/post-image-editor.tsx`** - Main editor screen
2. **`/src/components/ui/filter-slider.tsx`** - Reusable slider component for adjustments
3. **`/src/lib/image-filters.ts`** - Filter definitions and image processing utilities

### Modified Files:
1. **`/app/(app)/(tabs)/create.tsx`** - Add navigation to editor after image selection

---

## 2. Core Features

### 2.1 Image Display
- Full-screen image preview using `expo-image` or `Image` component
- Zoom and pan gestures using `react-native-gesture-handler`
- Before/after comparison (optional long-press to see original)

### 2.2 Filters Section
Pre-defined filter presets using `expo-image-manipulator`:
- **None** (original)
- **Clarendon** - Enhanced contrast + slight blue tint
- **Gingham** - Vintage fade + warm tones
- **Moon** - B&W + high contrast
- **Lark** - Brightened + cool tones
- **Reyes** - Sepia + vintage
- **Juno** - Warm + vibrant
- **Slumber** - Desaturated + hazy
- **Crema** - Creamy + pastel
- **Ludwig** - Desaturated + cool
- **Aden** - Pink/purple tint
- **Perpetua** - Pastel + soft
- **Amaro** - Bright + airy
- **Mayfair** - Warm + vignette
- **Rise** - Soft + warm glow
- **Hudson** - Cool + high contrast
- **Valencia** - Warm + faded
- **X-Pro II** - High contrast + orange/blue
- **Sierra** - Desaturated + vintage
- **Willow** - B&W + subtle purple
- **Lo-Fi** - Saturated + warm
- **Inkwell** - Pure B&W
- **Helena** - Orange/teal
- **Ashby** - Golden hour
- **Jupiter** -Cool + desaturated

### 2.3 Adjustment Tools
Sliders for fine-tuning:
- **Brightness** (-100 to 100)
- **Contrast** (-100 to 100)
- **Saturation** (-100 to 100)
- **Warmth** (-100 to 100)
- **Exposure** (-100 to 100)
- **Highlights** (-100 to 100)
- **Shadows** (-100 to 100)
- **Vignette** (0 to 100)

### 2.4 UI Components
- **Bottom Tab Bar**: Switch between "Filters" and "Adjust" tabs
- **Filter Carousel**: Horizontal scrollable list of filter thumbnails with labels
- **Slider Controls**: Custom sliders for adjustments with value indicators
- **Top Bar**: Back button, filter intensity toggle, Done button
- **Loading States**: Show processing indicators during filter application

---

## 3. Technical Implementation

### 3.1 State Management
```typescript
interface EditorState {
  selectedFilter: string;
  filterIntensity: number; // 0-100
  adjustments: {
    brightness: number;
    contrast: number;
    saturation: number;
    warmth: number;
    exposure: number;
    highlights: number;
    shadows: number;
    vignette: number;
  };
  isProcessing: boolean;
}
```

### 3.2 Image Processing Flow
1. User selects image in `create.tsx`
2. Navigate to `post-image-editor.tsx` with image URI in params
3. Load image with `expo-image-manipulator`
4. Apply filters/adjustments in real-time (debounced)
5. On "Done", process final image with all adjustments
6. Return edited image URI to `create.tsx` via navigation params
7. `create.tsx` receives edited image and displays preview

### 3.3 Performance Optimization
- Use `useMemo` for filter preview calculations
- Debounce slider changes (300ms delay)
- Process filters asynchronously with `useImageManipulator`
- Cache filter results to avoid re-processing
- Use shared values from `react-native-reanimated` for smooth slider animations

### 3.4 Navigation Pattern
```typescript
// create.tsx
router.push({
  pathname: '/post-image-editor',
  params: { 
    uri: selectedImage.uri,
    mediaType: 'image'
  }
});

// post-image-editor.tsx
const { uri } = useLocalSearchParams<{ uri: string }>();
const router = useRouter();

// After editing complete
router.back(); // or navigate back with edited image
```

---

## 4. Theme Integration

### Color Scheme (from `/src/theme/index.ts`)
Use existing theme colors:
- Background: `theme.colors.background`
- Surface: `theme.colors.surface` / `theme.colors.card`
- Text Primary: `theme.colors.textPrimary`
- Text Secondary: `theme.colors.textSecondary`
- Border: `theme.colors.border`
- Primary: `theme.colors.primary`
- Gradient: `theme.colors.gradient`

### Spacing & Radius
Follow existing patterns:
- `theme.spacing.xs/sm/md/lg/xl`
- `theme.radius.sm/md/lg/pill`

---

## 5. Component Breakdown

### 5.1 `post-image-editor.tsx` (Main Screen)
**Responsibilities:**
- Receive image URI from params
- Manage editor state (filters, adjustments)
- Render image preview
- Handle filter/adjustment UI
- Process and return edited image

**Key Sections:**
- Top toolbar (back, intensity toggle, done)
- Main image area (full viewport)
- Bottom panel (tabs + controls)

### 5.2 `filter-slider.tsx` (Reusable Component)
**Props:**
- `label`: string
- `value`: number
- `min`: number
- `max`: number
- `onChange`: (value: number) => void
- `format?: (value: number) => string

**Features:**
- Smooth slider with thumb
- Value display
- Tap to set value
- Theme-aware styling

### 5.3 `image-filters.ts` (Utilities)
**Exports:**
- `FILTERS` constant - Array of filter definitions
- `applyFilter()` - Function to apply filter to image
- `applyAdjustments()` - Function to apply adjustments
- `processImage()` - Combined processing function

**Filter Definition Interface:**
```typescript
interface FilterDefinition {
  id: string;
  name: string;
  thumbnail?: string; // Optional custom thumbnail
  adjustments: {
    brightness?: number;
    contrast?: number;
    saturation?: number;
    warmth?: number;
    // ... etc
  };
}
```

---

## 6. Step-by-Step Implementation Order

### Phase 1: Setup & Basic Structure
1. Create `/src/lib/image-filters.ts` with filter definitions
2. Create `/src/components/ui/filter-slider.tsx` component
3. Implement basic layout in `/app/(app)/post-image-editor.tsx`
4. Add image loading and display

### Phase 2: Filter System
5. Implement filter carousel UI
6. Connect expo-image-manipulator for filter preview
7. Add filter intensity control
8. Implement real-time filter application

### Phase 3: Adjustments
9. Add adjustment tab UI
10. Implement all adjustment sliders
11. Combine filters + adjustments
12. Add reset functionality

### Phase 4: Polish & Integration
13. Update `create.tsx` to navigate to editor
14. Handle image export back to create screen
15. Add loading states and error handling
16. Optimize performance (debouncing, caching)
17. Add haptic feedback on interactions
18. Test with various image sizes/formats

---

## 7. Dependencies

Already available in project:
- ✅ `expo-image-manipulator` ~14.0.8
- ✅ `expo-image` ~3.0.11
- ✅ `react-native-gesture-handler` ^2.30.0
- ✅ `react-native-reanimated` ~4.1.1
- ✅ `@gorhom/bottom-sheet` ^5.2.8
- ✅ `zustand` ^5.0.11 (if needed for state)

No additional dependencies required.

---

## 8. Edge Cases & Considerations

### Error Handling:
- Image loading failures
- Processing errors (memory limits)
- Permission issues
- Large image optimization

### UX Considerations:
- Show processing indicators
- Allow cancellation during processing
- Maintain aspect ratio
- Support both portrait/landscape images
- Handle very large/small images gracefully
- Provide "reset to original" option

### Performance:
- Limit concurrent image operations
- Clean up temporary files
- Use appropriate compression (0.9 quality)
- Consider memory management for large images

---

## 9. Testing Checklist

- [ ] Filter applies correctly
- [ ] Adjustments work independently
- [ ] Multiple adjustments combine properly
- [ ] Filter intensity slider works
- [ ] Before/after comparison shows correctly
- [ ] Navigation from/to create.tsx works
- [ ] Edited image returns to create screen
- [ ] All filters render unique looks
- [ ] Sliders are smooth and responsive
- [ ] Loading states appear during processing
- [ ] Works in both light/dark mode
- [ ] Handles different image orientations
- [ ] Memory efficient with large images

---

## 10. Future Enhancements (Out of Scope)

- Crop/rotate functionality
- Text overlays
- Stickers/drawings
- AI-powered enhancements
- Batch editing
- Custom filter creation
- Save filters as presets

---

This plan provides a complete, production-ready image editor that integrates seamlessly with your existing app architecture and theme system.