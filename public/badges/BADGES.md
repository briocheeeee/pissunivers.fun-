# Badge Folder Documentation

All badge files must be placed in `/public/badges/` directory.
Thumbnail versions go in `/public/badges/thumb/` as `.webp` files.
File versions go in `/public/badges/` as `.gif` files.

## Required Badge GIF Files

| Badge Name | GIF Filename | Description | Status |
|------------|--------------|-------------|--------|
| Bug Hunter | `bughunter.gif` | Awarded for reporting bugs | ✅ EXISTS |
| Premium | `premium.gif` | Awarded to premium members | ✅ EXISTS |
| VIP | `vip.gif` | Awarded to VIP members | ✅ EXISTS |
| First Pixel | `firstpixel.gif` | Awarded when user places their first pixel | ❌ NEEDED |
| Pixel Master | `pixelmaster.gif` | Awarded for placing 10,000 pixels in a day | ❌ NEEDED |
| Weekly Warrior | `weeklywarrior.gif` | Awarded for placing 50,000 pixels in a week | ❌ NEEDED |
| Chat Greeter | `chatgreeter.gif` | Awarded for saying hello in chat | ❌ NEEDED |
| Faction Leader | `factionleader.gif` | Awarded to faction owners | ❌ NEEDED |
| TOTW Winner | `totwwinner.gif` | Awarded to Team of the Week winners | ❌ NEEDED |
| TOTW Nominee | `totwnominee.gif` | Nominated for Team of the Week | ❌ NEEDED |
| TOTW Most Improved | `totwmostimproved.gif` | Awarded for Most Improved in TOTW | ❌ NEEDED |
| TOTW Underdog | `totwunderdog.gif` | Awarded for Underdog award in TOTW | ❌ NEEDED |
| TOTW Community Choice | `totwcommunitychoice.gif` | Awarded for Community Choice in TOTW | ❌ NEEDED |
| Veteran | `veteran.gif` | Awarded for 1 year of account age | ❌ NEEDED |
| Template Master | `templatemaster.gif` | Awarded for using 10 templates in a week | ❌ NEEDED |
| Social Butterfly | `socialbutterfly.gif` | Awarded for 1000 chat messages | ❌ NEEDED |
| Voxel Master | `voxelmaster.gif` | Awarded for placing 10,000 voxels in a week | ❌ NEEDED |
| Rainbow Artist | `rainbowartist.gif` | Awarded for using 20 different colors in a week | ❌ NEEDED |

## Thumbnail Requirements

- Format: WebP
- Size: 48x48 pixels recommended
- Location: `/public/badges/thumb/{badgename}.webp`

## Full Badge Requirements

- Format: GIF (animated preferred) or static PNG/WebP
- Size: 128x128 pixels recommended (minimum 48x48)
- Location: `/public/badges/{badgename}.gif`

---

## Recommended Sources for Animated GIF Badges

### Free Animated Icon Sources

1. **LottieFiles** (https://lottiefiles.com)
   - Search: "badge", "achievement", "trophy", "star", "crown"
   - Export as GIF (use their converter)
   - Free animations available
   - Recommended searches:
     - `trophy` for TOTW Winner
     - `star` for VIP/Premium
     - `crown` for Faction Leader
     - `medal` for achievements
     - `fire` for Pixel Master
     - `butterfly` for Social Butterfly

2. **Icons8 Animated** (https://icons8.com/icons/set/--animated)
   - Direct GIF download available
   - Search: "trophy animated", "star animated", "crown animated"
   - Free with attribution or paid for no attribution

3. **Flaticon Animated** (https://www.flaticon.com/animated-icons)
   - Large collection of animated icons
   - GIF export available
   - Search: "badge", "achievement", "medal"

4. **Pixabay GIFs** (https://pixabay.com/gifs/)
   - Completely free, no attribution required
   - Search: "trophy", "star", "badge", "medal"

5. **itch.io Game Assets** (https://itch.io/game-assets/free/tag-icons/tag-pixel-art)
   - Pixel art style badges
   - Many free packs available
   - Search: "achievement icons", "badge icons"

### Specific Badge Suggestions

| Badge | Suggested Search Terms | Best Source |
|-------|----------------------|-------------|
| First Pixel | "pixel sparkle", "cursor click", "first step" | LottieFiles |
| Pixel Master | "fire badge", "flame icon animated", "hot streak" | Icons8 |
| Weekly Warrior | "sword shield", "warrior badge", "knight" | LottieFiles |
| Chat Greeter | "chat bubble", "hello wave", "greeting" | Icons8 |
| Faction Leader | "crown animated", "leader badge", "king" | LottieFiles |
| TOTW Winner | "trophy gold animated", "winner cup" | LottieFiles/Icons8 |
| TOTW Nominee | "trophy silver", "medal animated", "nominee" | LottieFiles |
| TOTW Most Improved | "arrow up", "growth chart", "level up" | Icons8 |
| TOTW Underdog | "dog badge", "underdog", "wolf" | Pixabay |
| TOTW Community Choice | "heart badge", "community", "people" | LottieFiles |
| Veteran | "shield veteran", "star old", "ancient" | Icons8 |
| Template Master | "template icon", "grid badge", "blueprint" | Flaticon |
| Social Butterfly | "butterfly animated", "social" | LottieFiles/Pixabay |
| Voxel Master | "3d cube", "voxel", "minecraft block" | LottieFiles |
| Rainbow Artist | "rainbow", "colorful", "palette" | LottieFiles/Icons8 |

### Converting Lottie to GIF

1. Go to https://lottiefiles.com
2. Find your animation
3. Click "Download" > "GIF"
4. Set size to 128x128
5. Set background to transparent
6. Download and rename to match the required filename

### Tools for Creating Custom Badges

1. **Piskel** (https://www.piskelapp.com/) - Free online pixel art animator
2. **Aseprite** (paid) - Professional pixel art tool
3. **GIMP** - Free image editor with GIF support
4. **Canva** - Easy animated graphics (export as GIF)
