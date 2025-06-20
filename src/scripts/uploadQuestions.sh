#!/bin/bash

# Save the questions JSON to a file
cat > questions.json << 'EOL'
[
  {
    "id": "75e07a4d",
    "field": 4,
    "domain": 0,
    "difficulty": 0,
    "question": "To make sure they got the nutrition they needed while in space, the astronauts of NASA's Gemini missions were given menus for three meals a day (meals A, B, and C) on a four-day rotating schedule. Looking at the sample of food items from these menus, a student notes that on day 1, the menu included ______",
    "options": [
      "shrimp cocktail for meal B",
      "hot cocoa for meal C",
      "sugar cookie cubes for meal B",
      "chicken and vegetables for meal A"
    ],
    "answer": 2,
    "imageURL": "",
    "token": ""
  },
  {
    "id": "3091f805",
    "field": 4,
    "domain": 0,
    "difficulty": 0,
    "question": "Which finding from the experiment, if true, would most directly support Garza and Robles's hypothesis?",
    "options": [
      "None of the sea stars climbed to the tops of the tanks, but sea stars in the tank with only seawater moved around the bottom of the tank more than sea stars in the other tank did.",
      "Sea stars in the tank with only seawater climbed to the top of the tank, but sea stars in the other tank stopped climbing just below the layer of fresh water.",
      "Both groups of sea stars climbed to the tops of the tanks, but sea stars in the tank with only seawater climbed more slowly than sea stars in the other tank did.",
      "Sea stars in the tank with only seawater mostly stayed near the bottom of the tank, but sea stars in the other tank climbed into the layer of fresh water."
    ],
    "answer": 1,
    "imageURL": "",
    "token": ""
  },
  {
    "id": "0770b53d",
    "field": 4,
    "domain": 0,
    "difficulty": 0,
    "question": "Which quotation from O Pioneers! most effectively illustrates the claim that Alexandra has a deep emotional connection to her natural surroundings?",
    "options": [
      "She had never known before how much the country meant to her. The chirping of the insects down in the long grass had been like the sweetest music...",
      "Alexandra talked to the men about their crops and to the women about their poultry...",
      "Alexandra drove off alone. The rattle of her wagon was lost in the howling of the wind...",
      "It was Alexandra who read the papers and followed the markets..."
    ],
    "answer": 0,
    "imageURL": "",
    "token": ""
  },
  {
    "id": "6f626ae5",
    "field": 4,
    "domain": 0,
    "difficulty": 0,
    "question": "Which quotation from Walt Whitman's 'To You' most effectively illustrates the claim that readers haven't fully understood themselves?",
    "options": [
      "You have not known what you are, you have slumber'd upon yourself all your life...",
      "These immense meadows, these interminable rivers, you are immense and interminable as they.",
      "I should have made my way straight to you long ago...",
      "I will leave all and come and make the hymns of you..."
    ],
    "answer": 0,
    "imageURL": "",
    "token": ""
  },
  {
    "id": "85439572",
    "field": 4,
    "domain": 0,
    "difficulty": 0,
    "question": "Which finding, if true, would most directly support Armijo's hypothesis about solar-powered chile roasting?",
    "options": [
      "The temperature inside the roasting drum is distributed more evenly when roasting green chiles with solar power than with propane.",
      "Attempts to roast green chiles using 50 heliostats yields results in fewer than six minutes.",
      "Green chile connoisseurs prefer the flavor of solar-roasted green chiles over the flavor of propane-roasted green chiles.",
      "The skins of solar-roasted green chiles are easier to peel than the skins of propane-roasted green chiles."
    ],
    "answer": 1,
    "imageURL": "",
    "token": ""
  },
  {
    "id": "01989d77",
    "field": 4,
    "domain": 2,
    "difficulty": 0,
    "question": "This finding suggests that ______",
    "options": [
      "the presence of some kinds of underwater plants like watermilfoil helps prevent methane from escaping shallow lakes and ponds.",
      "shallow lakes and ponds release more methane than deeper bodies of water because shallow bodies of water usually have more plants than deep bodies of water do.",
      "shallow lakes and ponds are more likely to contain algae than to contain either watermilfoil or duckweed.",
      "having a mix of algae, underwater plants, and floating plants is the best way to reduce the amount of methane in shallow lakes and ponds."
    ],
    "answer": 0,
    "imageURL": "",
    "token": ""
  },
  {
    "id": "4603d1f7",
    "field": 4,
    "domain": 2,
    "difficulty": 0,
    "question": "Which choice most logically completes the text about 'pay as you wish' music pricing?",
    "options": [
      "prove financially successful for some musicians but disappointing for others.",
      "hold greater financial appeal for bands than for individual musicians.",
      "cause most musicians who use the model to lower the suggested prices of their songs and albums over time.",
      "more strongly reflect differences in certain musicians' popularity than traditional pricing models do."
    ],
    "answer": 0,
    "imageURL": "",
    "token": ""
  },
  {
    "id": "20000f5f",
    "field": 4,
    "domain": 2,
    "difficulty": 0,
    "question": "Which choice most logically completes the text about Sherlock Holmes adaptations?",
    "options": [
      "Doyle's original stories will become hard to find.",
      "people will become more interested in detective stories than they were in the 1800s.",
      "producing adaptations will become easier and less expensive.",
      "the former copyright holders of Doyle's estate will return fees they collected."
    ],
    "answer": 2,
    "imageURL": "",
    "token": ""
  },
  {
    "id": "6bc0e595",
    "field": 4,
    "domain": 2,
    "difficulty": 0,
    "question": "This finding suggests that ______",
    "options": [
      "people who mainly shop online probably spend more money every month than people who mainly shop in person do.",
      "in-person shopping may make products seem more valuable than they seem if only viewed online.",
      "retailers with in-person and online stores should charge the same price for a given product in both places.",
      "online retailers may be able to raise the prices they charge for products that are only available online."
    ],
    "answer": 1,
    "imageURL": "",
    "token": ""
  },
  {
    "id": "c4d43991",
    "field": 4,
    "domain": 2,
    "difficulty": 0,
    "question": "Which choice most logically completes the text about Shang dynasty bronze artifacts?",
    "options": [
      "Shang dynasty bronze pieces are rare and therefore more valuable than those from other time periods.",
      "the source of some of the raw materials used to make bronze was exploited only until the end of the Shang dynasty.",
      "bronze was used for a short time during the Shang dynasty before different metals were used to make artifacts.",
      "methods used to analyze bronze artifacts are not useful on pieces that are dated after the Shang dynasty."
    ],
    "answer": 1,
    "imageURL": "",
    "token": ""
  }
]
EOL

# Run the TypeScript script
npx ts-node src/scripts/uploadQuestions.ts 