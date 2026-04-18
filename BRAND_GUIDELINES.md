# CultivatED Brand & Copy Guidelines

## Table of Contents
1. [Brand Overview](#brand-overview)
2. [Brand Identity](#brand-identity)
3. [Design System](#design-system)
   - [The 3D Aesthetic](#the-3d-aesthetic-depth-through-thicker-bottom-borders)
4. [Typography](#typography)
5. [Color Palette](#color-palette)
6. [UI Components & Patterns](#ui-components--patterns)
7. [Tone of Voice](#tone-of-voice)
8. [Copy Guidelines](#copy-guidelines)
9. [Do's and Don'ts](#dos-and-donts)
10. [Examples](#examples)

---

## Brand Overview

### Mission
CultivatED is a free SAT preparation platform that makes test prep engaging, accessible, and effective. We combine gamified practice, adaptive learning algorithms, and AI-powered tutoring to help students master the SAT without the boredom.

### Core Values
- **Accessibility**: Free for all students, no barriers to entry
- **Engagement**: Learning should be enjoyable, not a chore
- **Personalization**: Every student gets a tailored experience
- **Results**: Focus on real score improvements, not just practice
- **Empowerment**: Students feel confident and in control

### Target Audience
- High school students preparing for the SAT
- Students at all skill levels (beginner to advanced)
- Students who want effective prep without the traditional tutor cost
- Schools and educators looking for comprehensive SAT prep tools

---

## Brand Identity

### Brand Name
**CultivatED** (always capitalize the "ED")

**Correct Usage:**
- Yes: CultivatED
- Yes: CultivatED Platform
- Yes: CultivatED for Schools

**Incorrect Usage:**
- No: Cultivated
- No: CultivateED
- No: cultivated
- No: CultivatEd

### Tagline
**Primary Tagline:**
> "Master the SAT with personalized practice sessions, detailed analytics, and comprehensive question banks."

**Hero Messaging:**
> "The SAT prep you'll [want to do / crush / actually enjoy]"

**Value Proposition:**
> "Gamified practice, real-time analytics, and your own personal AI Tutor. Master the SAT without the boredom."

### Brand Personality
CultivatED is:
- **Playful** but professional
- **Confident** but approachable
- **Supportive** but not condescending
- **Results-driven** but fun
- **Accessible** but high-quality

---

## Design System

### Design Philosophy
CultivatED's design is inspired by gamified learning platforms with a focus on:
- **Flat, clean aesthetics** with subtle depth
- **Playful interactions** that feel rewarding
- **Clear visual hierarchy** for easy navigation
- **Consistent rounded corners** for a friendly feel
- **3D button effects** for tactile feedback
- **Vibrant colors** that energize without overwhelming

### The 3D Aesthetic: Depth Through Thicker Bottom Borders

The 3D aesthetic is a core visual language element that transforms flat buttons into tactile, pressable elements. This design pattern creates a sense of depth and interactivity that makes the interface feel more engaging and game-like.

#### Visual Psychology

The thicker bottom border creates a **visual illusion of depth** by simulating how objects appear when lit from above:
- **Top edges** appear lighter (the main button color)
- **Bottom edges** appear darker (the thicker border)
- This mimics **natural lighting** where light comes from above, casting shadows below

This creates an **affordance**—a visual cue that tells users "this is pressable." The button appears to "sit above" the page, inviting interaction.

#### The Mechanics

**Default State (Resting):**
```
┌─────────────────┐
│                 │ ← 2px border (all sides)
│   BUTTON TEXT   │
│                 │
├─────────────────┤ ← 4px bottom border (thicker, darker)
│                 │
└─────────────────┘
```

**Implementation:**
- All borders: `border-2` (2px)
- Bottom border: `border-b-[4px]` (4px, double thickness)
- Bottom border color: Darker shade of button color (`#6EB514` for primary green)
- Shadow: `shadow-[0_4px_0_0_rgba(0,0,0,0.2)]` (adds depth)

**Hover State:**
- Background lightens slightly (e.g., `#89E219` → `#96F01E`)
- Shadow reduces: `shadow-[0_2px_0_0_rgba(0,0,0,0.2)]`
- Button translates up: `translate-y-[2px]` (2px upward movement)
- Bottom border remains 4px

**Active/Pressed State:**
- Bottom border reduces: `border-b-2` (back to 2px, matching other sides)
- Button translates down: `translate-y-[2px]` (2px downward)
- Shadow removed: `shadow-none`
- Creates a "pressed in" effect

**Visual Flow:**
```
Resting → Hover → Active
  ↓         ↓        ↓
Raised   Lifted   Pressed
(4px)    (2px)    (flat)
```

#### Size Variations

**Large Buttons (`size="lg"`):**
- Bottom border: `border-b-[4px]` (4px)
- Active translate: `translate-y-[2px]` (2px)

**Default Buttons (`size="default"`):**
- Bottom border: `border-b-[4px]` (4px)
- Active translate: `translate-y-[2px]` (2px)

**Small Buttons (`size="sm"`):**
- Bottom border: `border-b-[3px]` (3px, slightly thinner)
- Active translate: `translate-y-[1px]` (1px, less movement)
- Proportionally scaled for smaller elements

#### The Gamified Feel

This 3D effect creates a **game-like aesthetic** that:

1. **Makes actions feel rewarding**
   - Buttons feel like game pieces you can interact with
   - The press animation provides satisfying feedback
   - Creates a sense of accomplishment when clicked

2. **Reduces cognitive load**
   - Clear visual hierarchy: 3D buttons = primary actions
   - Users immediately understand what's clickable
   - No need to hover to discover interactivity

3. **Adds playfulness**
   - Makes the interface feel less serious and intimidating
   - Transforms SAT prep from "work" to "play"
   - Encourages exploration and experimentation

4. **Creates consistency**
   - All primary actions share the same visual language
   - Users learn the pattern quickly
   - Builds trust through predictable interactions

#### When to Use the 3D Effect

**DO use 3D effect for:**
- Yes: Primary action buttons (main CTAs)
- Yes: Secondary action buttons
- Yes: Outline buttons (with appropriate border colors)
- Yes: Important form submission buttons
- Yes: Navigation buttons that lead to key actions
- Yes: Any button that represents a significant user action

**DON'T use 3D effect for:**
- No: Ghost buttons (they're intentionally flat)
- No: Link buttons (they use underline instead)
- No: Icon-only buttons without text
- No: Disabled buttons
- No: Text links
- No: Decorative elements

#### Color-Specific Implementation

Each button variant uses a darker shade for the bottom border:

**Primary (Mask Green):**
- Background: `#89E219`
- Bottom border: `#6EB514` (darker green, ~20% darker)
- Creates depth while maintaining brand color

**Secondary (Macaw Blue):**
- Background: `#1CB0F6`
- Bottom border: `#1899D6` (darker blue)
- Same depth principle

**Destructive (Cardinal Red):**
- Background: `#FF4B4B`
- Bottom border: `#D43F3F` (darker red)
- Maintains urgency while feeling pressable

**Outline:**
- Background: White/transparent
- Border: `#E5E5E5` (Swan)
- Bottom border: Same color but 4px (subtle depth)
- Creates depth without color

**Super (Bee Yellow):**
- Background: `#FFC800`
- Bottom border: `#D9AA00` (darker yellow/orange)
- Special variant for premium features

#### The Overall Aesthetic Feel

The 3D button effect contributes to CultivatED's overall aesthetic:

**Playful but Professional:**
- The depth adds playfulness without being childish
- Maintains credibility while being approachable
- Balances fun with functionality

**Modern and Fresh:**
- References gamified apps students already know
- Feels contemporary, not dated
- Stands out from traditional educational tools

**Confident and Clear:**
- Bold visual statements
- No ambiguity about what's clickable
- Users feel confident in their interactions

**Engaging and Motivating:**
- Makes clicking buttons feel rewarding
- Encourages interaction and exploration
- Transforms mundane actions into engaging moments

#### Technical Implementation Details

**CSS Classes (Tailwind):**
```tsx
// Default state
"border-2 border-[#6EB514] border-b-[4px]"

// Hover state
"hover:bg-[#96F01E] hover:shadow-[0_2px_0_0_rgba(0,0,0,0.2)] hover:translate-y-[2px]"

// Active state
"active:border-b-2 active:translate-y-[2px] active:shadow-none active:scale-95"
```

**Transition Properties:**
- `transition-all` ensures smooth animations
- Duration: Default browser transitions (~150-200ms)
- Easing: Default ease-out for natural feel

**Accessibility Considerations:**
- Focus states use ring instead of 3D effect
- `focus-visible:ring-2` provides keyboard navigation feedback
- Active states provide clear visual feedback
- Sufficient color contrast maintained

#### Combining with Other Effects

The 3D effect works in harmony with other design elements:

**With Shadows:**
- The shadow (`shadow-[0_4px_0_0_rgba(0,0,0,0.2)]`) enhances the depth
- Creates a "floating" effect
- Reduces on hover to show button lifting

**With Rounded Corners:**
- `rounded-2xl` (24px) creates friendly, approachable shape
- The rounded corners make the 3D effect feel softer
- Prevents harsh, angular appearance

**With Color:**
- Vibrant colors make the depth more noticeable
- Darker bottom borders create stronger contrast
- Color + depth = maximum visual impact

**With Typography:**
- Bold, uppercase text complements the bold 3D effect
- Creates a cohesive, confident appearance
- Text feels "pressed into" the button surface

#### Best Practices

**DO:**
- Yes: Use consistent border thickness ratios (2px sides, 4px bottom)
- Yes: Maintain darker bottom border color (~20% darker)
- Yes: Keep transitions smooth and quick
- Yes: Use appropriate sizing (larger buttons = more depth)
- Yes: Test on different devices and screen sizes

**DON'T:**
- No: Mix 3D effects with flat buttons inconsistently
- No: Use bottom borders that are too thick (>6px looks unnatural)
- No: Forget to reduce border on active state
- No: Use 3D effect on elements that aren't interactive
- No: Overuse the effect (reserve for important actions)

#### The Emotional Impact

The 3D aesthetic creates specific emotional responses:

**Before Interaction:**
- Curiosity: "What happens if I click this?"
- Confidence: "I know this is clickable"
- Excitement: "This looks fun to interact with"

**During Interaction:**
- Satisfaction: The press feels responsive
- Control: User feels in command
- Engagement: Interaction feels rewarding

**After Interaction:**
- Accomplishment: "I did something"
- Progress: Visual feedback confirms action
- Motivation: Encourages continued interaction

This emotional journey transforms mundane interactions into engaging experiences, making SAT prep feel less like work and more like play.

### Border Radius
- **Base radius**: `1rem` (16px)
- **Small radius**: `calc(var(--radius) - 4px)` = 12px
- **Medium radius**: `calc(var(--radius) - 2px)` = 14px
- **Large radius**: `1rem` = 16px
- **Extra large radius**: `calc(var(--radius) + 4px)` = 20px

**Usage:**
- Cards: `rounded-2xl` (24px) or `rounded-3xl` (32px)
- Buttons: `rounded-2xl` (24px)
- Inputs: `rounded-2xl` (24px)
- Badges: `rounded-xl` (20px)

---

## Typography

### Primary Font
**DIN Round Pro** (used for both display and body text)

**Font Stack:**
```css
font-family: var(--font-din), sans-serif;
```

### Font Usage

**Display Font** (`font-display`):
- Headlines (h1, h2, h3)
- Hero text
- Large call-to-action text
- Brand name

**Body Font** (`font-sans`):
- Body text
- Descriptions
- UI labels
- Form inputs

### Typography Scale

**Headings:**
- `h1`: `text-4xl md:text-6xl lg:text-7xl` (Hero headlines)
- `h2`: `text-3xl md:text-5xl` (Section headlines)
- `h3`: `text-2xl md:text-3xl` (Subsection headlines)
- `h4`: `text-xl md:text-2xl` (Card titles)

**Body Text:**
- Large: `text-lg md:text-xl` (Hero descriptions, important text)
- Base: `text-base` (Default body text)
- Small: `text-sm` (Captions, labels, metadata)
- Extra Small: `text-xs` (Uppercase labels, timestamps)

### Font Weights
- **Black** (`font-black`): Hero headlines (900)
- **Bold** (`font-bold`): Section headlines, CTAs, emphasis (700)
- **Semibold** (`font-semibold`): Subheadings, labels (600)
- **Medium** (`font-medium`): Body emphasis (500)
- **Regular** (`font-normal`): Default body text (400)

### Letter Spacing
- **Tight** (`tracking-tight`): Headlines
- **Normal**: Default body text
- **Wide** (`tracking-wide`): Uppercase labels, buttons
- **Wider** (`tracking-wider`): Navigation items, badges

### Text Transform
- **Uppercase**: Buttons, navigation items, labels, badges
- **Capitalize**: Headlines (when appropriate)
- **Lowercase**: Body text, descriptions

---

## Color Palette

### Primary Colors

#### Mask Green (Primary)
- **Hex**: `#89E219`
- **Usage**: Primary CTAs, success states, progress indicators, brand accents
- **Foreground**: White (`#FFFFFF`)
- **Edge/Dark**: `#6EB514` (for 3D button effects)
- **Hover**: `#96F01E`

**When to use:**
- Primary action buttons
- Success messages
- Progress bars
- Active states
- Brand highlights

#### Macaw Blue (Secondary)
- **Hex**: `#1CB0F6`
- **Usage**: Secondary actions, links, informational elements
- **Foreground**: White (`#FFFFFF`)
- **Edge/Dark**: `#1899D6`
- **Hover**: `#40C3FF`

**When to use:**
- Secondary buttons
- Links
- Info badges
- Chart colors
- Accent elements

### Status Colors

#### Cardinal Red (Destructive)
- **Hex**: `#FF4B4B`
- **Usage**: Errors, destructive actions, warnings
- **Foreground**: White (`#FFFFFF`)
- **Edge/Dark**: `#D43F3F`
- **Hover**: `#FF6464`

**When to use:**
- Error messages
- Delete/remove actions
- Critical warnings
- Chart colors (for negative data)

#### Bee Yellow (Warning)
- **Hex**: `#FFC800`
- **Usage**: Warnings, highlights, special features
- **Foreground**: Eel (`#4B4B4B`)
- **Edge/Dark**: `#D9AA00`
- **Hover**: `#FFD433`

**When to use:**
- Warning messages
- Special badges (e.g., "Super" features)
- Chart colors
- Attention-grabbing elements

#### Fox Orange
- **Hex**: `#FF9600`
- **Usage**: Chart colors, accent elements
- **Foreground**: Eel (`#4B4B4B`)

### Neutral Colors

#### Eel (Foreground)
- **Hex**: `#4B4B4B`
- **Usage**: Primary text color, dark elements

#### Snow (Background)
- **Hex**: `#FFFFFF`
- **Usage**: Primary background, cards

#### Swan (Borders)
- **Hex**: `#E5E5E5`
- **Usage**: Borders, input borders, dividers

#### Polar (Muted Background)
- **Hex**: `#F7F7F7`
- **Usage**: Muted backgrounds, hover states

#### Hare (Muted Foreground)
- **Hex**: `#AFAFAF`
- **Usage**: Secondary text, placeholders, disabled states

#### Wolf (Dark Muted)
- **Hex**: `#777777`
- **Usage**: Tertiary text, dark mode muted text

### Dark Mode Colors

#### Background
- **Hex**: `#131F24` (Very dark blue-grey)
- **Usage**: Dark mode background

#### Foreground (Dark Mode)
- **Hex**: `#FFFFFF` (Snow)
- **Usage**: Text in dark mode

#### Muted (Dark Mode)
- **Hex**: `#202F36`
- **Usage**: Cards, muted backgrounds in dark mode

#### Border (Dark Mode)
- **Hex**: `#37464F`
- **Usage**: Borders in dark mode

### Color Usage Guidelines

**DO:**
- Yes: Use Mask Green for primary actions and success states
- Yes: Use Macaw Blue for secondary actions and links
- Yes: Use Cardinal Red sparingly for errors and destructive actions
- Yes: Maintain sufficient contrast ratios (WCAG AA minimum)
- Yes: Use neutral colors for backgrounds and text hierarchy

**DON'T:**
- No: Use primary colors for large background areas
- No: Mix color meanings (e.g., don't use red for success)
- No: Use colors that aren't in the palette
- No: Use low-contrast color combinations
- No: Overuse vibrant colors (balance with neutrals)

---

## UI Components & Patterns

### Buttons

#### Primary Button
```tsx
<Button variant="default" size="lg">
  PRIMARY ACTION
</Button>
```

**Styling:**
- Background: Mask Green (`#89E219`)
- Text: White, bold, uppercase
- Border: 2px solid `#6EB514` (all sides)
- Bottom border: 4px solid `#6EB514` (thicker, creates 3D depth)
- Border radius: `rounded-2xl` (24px)
- Letter spacing: `tracking-wider`
- Shadow: `shadow-[0_4px_0_0_rgba(0,0,0,0.2)]` (enhances depth)
- Hover: Lighter green (`#96F01E`), shadow reduces to 2px, translate up 2px
- Active: Bottom border reduces to 2px, shadow removed, translate down 2px, scale 95%

**3D Effect Details:**
See [The 3D Aesthetic](#the-3d-aesthetic-depth-through-thicker-bottom-borders) section for comprehensive explanation of the visual psychology, mechanics, and emotional impact of this design pattern.

**When to use:**
- Main call-to-action
- Primary user actions
- Submit buttons
- "Get Started" buttons

#### Secondary Button
```tsx
<Button variant="secondary" size="lg">
  SECONDARY ACTION
</Button>
```

**Styling:**
- Background: Macaw Blue (`#1CB0F6`)
- Same 3D effect as primary
- Hover: `#40C3FF`

**When to use:**
- Secondary actions
- Alternative options
- Less critical actions

#### Outline Button
```tsx
<Button variant="outline" size="lg">
  OUTLINE ACTION
</Button>
```

**Styling:**
- Background: Transparent/white
- Border: 2px solid Swan (`#E5E5E5`)
- Text: Eel (`#4B4B4B`)
- Same 3D effect
- Hover: Light background (`#F7F7F7`)

**When to use:**
- Tertiary actions
- "Cancel" buttons
- Less prominent actions

#### Ghost Button
```tsx
<Button variant="ghost">
  GHOST ACTION
</Button>
```

**Styling:**
- No background
- No border
- Text: Eel (`#4B4B4B`)
- Hover: Light background

**When to use:**
- Subtle actions
- Navigation items
- Icon-only buttons

### Cards

**Styling:**
- Background: Snow (`#FFFFFF`) or Card color
- Border: 2px solid Swan (`#E5E5E5`)
- Border radius: `rounded-2xl` (24px) or `rounded-3xl` (32px)
- Shadow: `shadow-sm` (subtle)
- Hover: `shadow-md` (elevated)

**Padding:**
- Small: `p-4` (16px)
- Medium: `p-6` (24px)
- Large: `p-8` (32px)

### Badges

**Styling:**
- Background: Muted (`#F7F7F7`) or colored
- Text: Small, bold, uppercase
- Border radius: `rounded-xl` (20px)
- Letter spacing: `tracking-wider`
- Padding: `px-3 py-1`

**Variants:**
- Default: Muted background
- Success: Mask Green background
- Warning: Bee Yellow background
- Error: Cardinal Red background
- Info: Macaw Blue background

### Inputs

**Styling:**
- Background: Snow (`#FFFFFF`)
- Border: 2px solid Swan (`#E5E5E5`)
- Border radius: `rounded-2xl` (24px)
- Padding: `px-4 py-3`
- Focus: Ring color Mask Green (`#89E219`)

### Progress Indicators

**Styling:**
- Background: Muted (`#F7F7F7`)
- Fill: Mask Green (`#89E219`)
- Border radius: `rounded-full`
- Height: `h-2` (8px) or `h-3` (12px)

### Shadows

**Usage:**
- `shadow-sm`: Cards, subtle elevation
- `shadow-md`: Hover states, elevated cards
- `shadow-lg`: Modals, important elements
- `shadow-xl`: Overlays, floating elements
- `shadow-2xl`: Hero elements, major CTAs

**3D Button Shadows:**

The shadow system works in harmony with the thicker bottom border to create depth:

- **Default State**: `shadow-[0_4px_0_0_rgba(0,0,0,0.2)]`
  - Creates a 4px shadow directly below the button
  - Matches the 4px bottom border thickness
  - Uses 20% opacity black for subtle depth
  - Makes the button appear to "float" above the page

- **Hover State**: `shadow-[0_2px_0_0_rgba(0,0,0,0.2)]`
  - Shadow reduces to 2px as button lifts
  - Combined with `translate-y-[2px]` creates lifting effect
  - Signals interactivity before click

- **Active State**: `shadow-none`
  - Shadow completely removed
  - Combined with border reduction and downward translation
  - Creates "pressed into page" effect
  - Provides clear tactile feedback

**Visual Relationship:**
```
Shadow + Bottom Border = Total Depth Perception
4px shadow + 4px border = 8px perceived depth
```

The shadow and border work together—the shadow extends the visual depth created by the thicker border, making buttons feel more three-dimensional and pressable.

### Spacing

**Consistent spacing scale:**
- `gap-2`: 8px (tight)
- `gap-4`: 16px (default)
- `gap-6`: 24px (comfortable)
- `gap-8`: 32px (spacious)
- `gap-12`: 48px (section spacing)

**Padding:**
- `p-4`: 16px
- `p-6`: 24px
- `p-8`: 32px

**Margin:**
- `mb-4`: 16px
- `mb-6`: 24px
- `mb-8`: 32px
- `mb-12`: 48px
- `mb-16`: 64px

---

## Tone of Voice

### Core Principles

1. **Confident but Approachable**
   - Speak with authority about SAT prep
   - Avoid being condescending or intimidating
   - Use "we" and "you" to create connection

2. **Encouraging and Supportive**
   - Celebrate progress, not just perfection
   - Use positive framing
   - Acknowledge challenges without dwelling on them

3. **Direct and Concise**
   - Get to the point quickly
   - Avoid unnecessary words
   - Use active voice

4. **Conversational, Not Formal**
   - Use contractions ("you'll", "it's", "we're")
   - Write like you're talking to a friend
   - Avoid corporate jargon

5. **Results-Focused**
   - Emphasize outcomes and improvements
   - Use specific numbers when possible
   - Show, don't just tell

6. **Fun but Serious**
   - Acknowledge that SAT prep can be enjoyable
   - Don't make light of the importance of the test
   - Balance playfulness with credibility

### Voice Characteristics

**We are:**
- Yes: Enthusiastic but not over-the-top
- Yes: Helpful but not pushy
- Yes: Professional but not stuffy
- Yes: Friendly but not casual to a fault
- Yes: Clear but not oversimplified

**We are NOT:**
- No: Overly academic or pretentious
- No: Condescending or patronizing
- No: Corporate or soulless
- No: Overly casual or unprofessional
- No: Vague or wishy-washy

### Tone by Context

**Landing Page:**
- Energetic and inspiring
- Focus on benefits and outcomes
- Use aspirational language

**Onboarding:**
- Welcoming and supportive
- Clear instructions
- Reassuring about the process

**Practice Interface:**
- Encouraging and motivating
- Clear and actionable
- Celebrate wins, learn from mistakes

**Error Messages:**
- Helpful and solution-oriented
- Not blaming or harsh
- Offer next steps

**Success Messages:**
- Genuinely celebratory
- Specific about achievements
- Motivating for next steps

---

## Copy Guidelines

### Writing Style

#### Sentence Structure
- **Keep sentences short** (15-20 words average)
- **Vary sentence length** for rhythm
- **Start with the most important information**
- **Use parallel structure** in lists

**Good:**
> "Master the SAT with personalized practice. Get real-time feedback. Track your progress."

**Bad:**
> "CultivatED is a comprehensive SAT preparation platform that offers personalized practice sessions, real-time feedback mechanisms, and detailed progress tracking capabilities."

#### Word Choice

**Use:**
- Yes: Simple, everyday words
- Yes: Action verbs
- Yes: Specific numbers
- Yes: Contractions
- Yes: "You" and "we"

**Avoid:**
- No: Jargon or technical terms
- No: Passive voice
- No: Vague qualifiers ("very", "really", "quite")
- No: Corporate buzzwords ("leverage", "synergy", "optimize")
- No: Academic language ("utilize", "facilitate", "implement")

**Examples:**

**Good:**
> "Your score went up 200 points!"
> "We'll help you crush the SAT."
> "Practice for 10 minutes a day."

**Bad:**
> "Your score experienced a significant increase of 200 points!"
> "We will facilitate your success on the SAT examination."
> "Engage in practice sessions of approximately 10 minutes daily."

#### Headlines

**Guidelines:**
- Keep under 10 words when possible
- Use active voice
- Focus on benefits, not features
- Use numbers when relevant
- Make it scannable

**Good:**
> "The SAT prep you'll actually enjoy"
> "200+ point score improvements"
> "Your personal AI tutor, 24/7"

**Bad:**
> "Comprehensive SAT Preparation Platform with Advanced Features"
> "Significant Score Improvements"
> "AI-Powered Tutoring Solution Available Around the Clock"

#### CTAs (Call-to-Actions)

**Guidelines:**
- Use action verbs
- Be specific about what happens next
- Keep it short (1-3 words)
- Use uppercase for emphasis
- Create urgency without pressure

**Good:**
- "REQUEST ACCESS"
- "START PRACTICING"
- "TRY DEMO"
- "JOIN THE WAITLIST"

**Bad:**
- "Click here"
- "Learn more"
- "Submit"
- "Continue"

#### Descriptions

**Guidelines:**
- Lead with the benefit
- Use concrete examples
- Keep paragraphs short (2-3 sentences)
- Use bullet points for lists
- End with a clear next step

**Good:**
> "Master the SAT with personalized practice sessions, detailed analytics, and comprehensive question banks. Our AI tutor explains concepts in a way that makes sense—not just answers. Start improving your score today."

**Bad:**
> "CultivatED is a comprehensive educational technology platform designed to facilitate SAT preparation through the utilization of advanced adaptive learning algorithms, sophisticated analytics capabilities, and an extensive question bank repository. Our artificial intelligence-powered tutoring system provides explanations."

### Content Types

#### Landing Page Copy

**Hero Section:**
- Big, bold headline
- Clear value proposition
- Strong CTA
- Social proof (optional)

**Features:**
- Benefit-focused headlines
- Short descriptions
- Visual icons or illustrations
- Clear, scannable format

**Testimonials:**
- Real, specific results
- Authentic voice
- Include name and context
- Focus on outcomes

#### Onboarding Copy

**Guidelines:**
- Welcome warmly
- Explain why we're asking
- Keep instructions clear
- Reassure about privacy
- Celebrate completion

**Good:**
> "Let's get you set up! This will only take a few minutes."
> "We use this to personalize your practice."
> "Almost done! Just a few more questions."

**Bad:**
> "Please complete the following form."
> "This information is required."
> "Step 3 of 12."

#### Error Messages

**Guidelines:**
- Explain what went wrong
- Suggest how to fix it
- Use friendly, helpful tone
- Avoid technical jargon

**Good:**
> "Oops! That answer didn't match. Want to try again?"
> "Something went wrong. Don't worry—your progress is saved. Try refreshing the page."

**Bad:**
> "Error 404: Invalid response."
> "Submission failed. Please try again."

#### Success Messages

**Guidelines:**
- Celebrate genuinely
- Be specific about achievements
- Motivate next steps
- Use positive language

**Good:**
> "Nice work! You got 8 out of 10 correct. Keep it up!"
> "Congratulations! Your score improved by 50 points this week."

**Bad:**
> "Success."
> "Answer submitted."

---

## Do's and Don'ts

### Brand Name

**DO:**
- Yes: Always capitalize "CultivatED" (capital E and D)
- Yes: Use the full name on first reference
- Yes: Use "CultivatED" consistently across all materials

**DON'T:**
- No: Write "Cultivated" or "cultivated"
- No: Abbreviate to "CE" or "Cult"
- No: Use variations like "CultivateED" or "CultivatEd"

### Design

**DO:**
- Yes: Use Feather Green for primary actions
- Yes: Maintain consistent border radius (rounded-2xl for most elements)
- Yes: Use 3D button effects for primary CTAs
- Yes: Keep spacing consistent (gap-4, gap-6, gap-8)
- Yes: Use uppercase for buttons and labels
- Yes: Maintain sufficient color contrast
- Yes: Use shadows sparingly and consistently

**DON'T:**
- No: Mix different border radius sizes arbitrarily
- No: Use flat buttons for primary actions
- No: Overuse vibrant colors
- No: Create custom colors outside the palette
- No: Use low-contrast text
- No: Mix design patterns (stick to the system)

### Typography

**DO:**
- Yes: Use DIN Round Pro for all text
- Yes: Use font-black for hero headlines
- Yes: Use font-bold for section headlines and CTAs
- Yes: Use uppercase for buttons and navigation
- Yes: Use tracking-wider for uppercase text
- Yes: Maintain clear hierarchy (h1 > h2 > h3 > body)

**DON'T:**
- No: Use other fonts (no Arial, Helvetica, etc.)
- No: Mix font weights arbitrarily
- No: Use lowercase for buttons
- No: Create custom font sizes outside the scale
- No: Use all caps for body text

### Copy

**DO:**
- Yes: Write in second person ("you", "your")
- Yes: Use contractions ("you'll", "it's", "we're")
- Yes: Keep sentences short and clear
- Yes: Use active voice
- Yes: Be specific with numbers ("200 points" not "significant improvement")
- Yes: Focus on benefits, not features
- Yes: Use action verbs in CTAs

**DON'T:**
- No: Use passive voice ("Your score was improved" → "Your score improved")
- No: Use jargon or technical terms unnecessarily
- No: Write long, complex sentences
- No: Use vague language ("very good" → "great")
- No: Use corporate buzzwords ("leverage", "synergy")
- No: Write in third person ("users" → "you")
- No: Use generic CTAs ("Click here" → "START PRACTICING")

### Tone

**DO:**
- Yes: Be encouraging and supportive
- Yes: Celebrate progress and achievements
- Yes: Acknowledge challenges without dwelling
- Yes: Write conversationally
- Yes: Show enthusiasm appropriately
- Yes: Be helpful and solution-oriented

**DON'T:**
- No: Be condescending or patronizing
- No: Use overly formal language
- No: Be negative or discouraging
- No: Use corporate speak
- No: Be overly casual or unprofessional
- No: Blame users for mistakes

### Content

**DO:**
- Yes: Emphasize that CultivatED is free
- Yes: Highlight specific results ("200+ points", "340+ students")
- Yes: Use testimonials with real names and contexts
- Yes: Focus on outcomes, not just features
- Yes: Provide clear next steps
- Yes: Use examples and concrete details

**DON'T:**
- No: Hide the fact that it's free
- No: Use vague claims ("many students", "some users")
- No: Focus only on features without benefits
- No: Leave users wondering what to do next
- No: Use generic testimonials
- No: Make unsupported claims

### UI/UX

**DO:**
- Yes: Make CTAs prominent and clear
- Yes: Provide feedback for all actions
- Yes: Use progress indicators
- Yes: Show success states clearly
- Yes: Handle errors gracefully
- Yes: Maintain consistent patterns

**DON'T:**
- No: Hide important actions
- No: Leave users guessing
- No: Use inconsistent patterns
- No: Ignore errors or failures
- No: Create confusing navigation
- No: Overwhelm with too many options

---

## Examples

### Landing Page Hero

**Good:**
```markdown
# The SAT prep you'll actually enjoy

Gamified practice, real-time analytics, and your own personal AI Tutor. Master the SAT without the boredom.

[REQUEST ACCESS] [Try Demo]
```

**Bad:**
```markdown
# Comprehensive SAT Preparation Platform

CultivatED is an innovative educational technology solution that leverages advanced artificial intelligence and adaptive learning algorithms to facilitate comprehensive SAT test preparation through personalized practice sessions, detailed performance analytics, and an extensive question bank repository.

[Learn More] [Get Started]
```

### Feature Description

**Good:**
> "Your personal AI tutor explains concepts in a way that makes sense—not just answers. Ask questions, get hints, and receive guidance tailored to your level. Available 24/7."

**Bad:**
> "Our AI-powered tutoring system utilizes advanced natural language processing capabilities to provide comprehensive explanations and personalized guidance through an interactive conversational interface that is accessible at any time."

### CTA Button

**Good:**
```tsx
<Button variant="default" size="lg">
  START PRACTICING
</Button>
```

**Bad:**
```tsx
<Button variant="default" size="lg">
  Click Here to Begin Your Practice Session
</Button>
```

### Success Message

**Good:**
> "Nice work! You got 8 out of 10 correct. Your score improved by 12 points this session. Keep it up!"

**Bad:**
> "Success. Answer submitted."

### Error Message

**Good:**
> "Oops! That answer didn't match. Want to try again? The AI tutor can help explain the concept."

**Bad:**
> "Error: Incorrect answer. Please try again."

### Testimonial

**Good:**
> "My SAT score went up 200 points in just 3 weeks! The AI tutor actually explains things in a way that makes sense."
> — Sarah Jenkins, High School Junior

**Bad:**
> "Great platform! Highly recommend."
> — Student

---

## Quick Reference

### Brand Colors
- **Primary**: `#89E219` (Mask Green)
- **Secondary**: `#1CB0F6` (Macaw Blue)
- **Destructive**: `#FF4B4B` (Cardinal Red)
- **Warning**: `#FFC800` (Bee Yellow)
- **Foreground**: `#4B4B4B` (Eel)
- **Background**: `#FFFFFF` (Snow)

### Typography
- **Font**: DIN Round Pro
- **Hero**: `text-4xl md:text-6xl lg:text-7xl font-black`
- **Headline**: `text-3xl md:text-5xl font-bold`
- **Body**: `text-base`
- **Button**: `font-bold uppercase tracking-wider`

### Spacing
- **Gap**: `gap-4` (16px), `gap-6` (24px), `gap-8` (32px)
- **Padding**: `p-4` (16px), `p-6` (24px), `p-8` (32px)
- **Border Radius**: `rounded-2xl` (24px)

### Tone Checklist
- Yes: Conversational
- Yes: Encouraging
- Yes: Direct
- Yes: Results-focused
- Yes: Accessible

---

**Last Updated**: [Current Date]
**Version**: 1.0

For questions or clarifications about these guidelines, please contact the design team.
