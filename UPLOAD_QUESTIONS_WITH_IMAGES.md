# 📸 How to Upload Questions with Images

This guide shows you how to upload questions with images using the admin web interface.

## 🚀 Quick Start

### 1. **Access the Admin Panel**
Navigate to `/admin/upload-question` in your browser after logging in with an authorized account.

### 2. **Choose Upload Method**
- **Single Question**: Upload one question at a time with file uploads for images
- **JSON Upload**: Upload multiple questions at once using the JSON format

## 🎯 Using the Admin Interface

### **Single Question Upload**
The easiest way to add questions with images:

1. **Fill in Basic Information**
   - Question ID (must be unique)
   - Field (0-46) and Domain (0-7) 
   - Difficulty level (0-2)

2. **Enter Your Question**
   - Type the question text in the text area

3. **Add Question Image (Optional)**
   - Click "Choose File" under Question Image
   - Select PNG, JPG, or WebP files
   - Preview appears immediately

4. **Configure Answer Options**
   - Enter text for each option (A, B, C, D)
   - Optionally add images to any option
   - Select the correct answer

5. **Add Reading Passage (Optional)**
   - For reading comprehension questions
   - Enter passage text in the provided area

6. **Upload**
   - Click "Upload Question" to save to database
   - Images are automatically uploaded to Firebase Storage
   - Progress indicator shows upload status

### **JSON Bulk Upload**
For uploading multiple questions at once:

1. **Prepare Your JSON**
   - Use the format shown in `example-questions-with-images.json`
   - Include direct image URLs (not local file paths)

2. **Paste JSON Content**
   - Switch to "JSON Upload" tab
   - Paste your JSON array into the text area

3. **Upload**
   - Click "Upload JSON Questions"
   - All questions are processed automatically

## 📝 Question JSON Format

### **Basic Question Structure**
```json
{
  "id": "unique-question-id",
  "field": 0,
  "domain": 0, 
  "difficulty": 1,
  "question": "What does this graph show?",
  "options": ["Option A", "Option B", "Option C", "Option D"],
  "answer": 1
}
```

### **Question with Image**
```json
{
  "id": "math-graph-question",
  "field": 0,
  "domain": 0,
  "difficulty": 1,
  "question": "Based on the graph shown, what is the approximate value of y when x = 3?",
  "options": ["5", "7", "9", "11"],
  "answer": 1,
  "questionImage": {
    "url": "https://your-firebase-storage-url.com/image.png",
    "alt": "Mathematical graph showing linear relationship"
  }
}
```

### **Options with Images**
```json
{
  "id": "shapes-question",
  "field": 3,
  "domain": 3,
  "difficulty": 0,
  "question": "Which shape has the largest area?",
  "options": [
    {
      "text": "Shape A",
      "imageURL": "https://your-storage.com/square.png",
      "alt": "A 5x5 square"
    },
    {
      "text": "Shape B", 
      "imageURL": "https://your-storage.com/circle.png",
      "alt": "A circle with radius 3"
    }
  ],
  "answer": 1
}
```

### **Question with Reading Passage**
```json
{
  "id": "reading-question",
  "field": 4,
  "domain": 4,
  "difficulty": 1,
  "question": "According to the passage, what is the main cause of the water cycle?",
  "passage": "The water cycle is driven by solar energy that heats water in oceans, lakes, and rivers, causing evaporation...",
  "options": [
    "Solar energy",
    "Wind patterns",
    "Ocean currents", 
    "Atmospheric pressure"
  ],
  "answer": 0
}
```

## 🎨 Image Support Features

### **Question Images**
- Displayed prominently next to the question text
- Support for PNG, JPG, WebP formats
- Automatic resizing and optimization
- Loading states and error handling
- Sticky positioning for better UX

### **Option Images**
- Can be combined with text or used alone
- Automatic alt text generation
- Responsive grid layout
- Visual selection indicators

### **Enhanced UI**
- Question images now appear in a dedicated column (like reading passages)
- Improved layout automatically adjusts based on content
- Better organization with images separate from question/options

## 📋 Field & Domain Reference

| Field | Domain | Subject Area |
|-------|--------|--------------|
| 0-7   | 0      | Algebra |
| 8-17  | 1      | Problem Solving |
| 18-30 | 2      | Advanced Math |
| 31-36 | 3      | Geometry |
| 37-39 | 4      | Information & Ideas |
| 40-42 | 5      | Craft & Structure |
| 43-44 | 6      | Expression of Ideas |
| 45-46 | 7      | Standard English |

## ✅ Best Practices

1. **Image Quality**: Use clear, high-resolution images under 2MB
2. **Descriptive IDs**: Use meaningful question IDs like "algebra-quadratic-1"
3. **Alt Text**: The system generates alt text automatically for accessibility
4. **Testing**: Preview questions before uploading
5. **Organization**: Group related questions by subject/topic
6. **Backup**: The admin interface shows upload status for verification

## 🔐 Authorization

- Only authorized users can access `/admin/upload-question`
- Contact your administrator to add your email to the authorized list
- Must be logged in with a valid account

## 🚨 Troubleshooting

### **Access Denied**
- Ensure you're logged in
- Verify your email is in the authorized users list
- Contact administrator for access

### **Upload Fails**
- Check that all required fields are filled
- Ensure image files are valid formats (PNG, JPG, WebP)
- Verify Firebase connection (check browser console for errors)

### **JSON Format Errors**
- Validate JSON syntax using a JSON validator
- Check that all required fields are present
- Ensure question IDs are unique

## 🎯 Result

After successful upload, your questions will:
- ✅ Be immediately available in practice sessions
- ✅ Have optimized images with fast loading
- ✅ Support both desktop and mobile viewing
- ✅ Include proper accessibility features
- ✅ Work seamlessly with the adaptive learning system

The new admin interface provides a streamlined workflow for creating high-quality questions with rich media support! 