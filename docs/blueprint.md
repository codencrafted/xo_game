# **App Name**: Code Clash Tic Tac Toe

## Core Features:

- Code-Based Authentication: Require authentication using a secret access code ('2402' for Preet, '1009' for Prince) to enter the game.
- XO Board: Display a 3x3 Tic Tac Toe board.
- Real-Time Sync: Synchronize game state in real-time using Firebase Realtime Database (or Cloud Firestore), reflecting player moves.
- Turn Indicator: Display whose turn it is (Player 1 - X, Player 2 - O).
- Game Result Display: Display a win/loss/draw message with an option to restart the game. Also display each player's username (Preet and Prince) on the screen.
- Player Limit: Restrict access to only two players, preventing third-party connections using the access codes.

## Style Guidelines:

- Primary color: Deep indigo (#4B0082) evoking a sense of intellect and strategy.
- Background color: Very light lavender (#F0F8FF), nearly white, creating a clean and unobtrusive backdrop.
- Accent color: Saturated magenta (#FF00FF) adding vibrancy to the user's interactions, such as button clicks or other visual cues, in contrast to the overall theme.
- Font: 'Inter', a grotesque sans-serif, providing a modern and neutral look for both headlines and body text. Note: currently only Google Fonts are supported.
- Simple, clear icons for X and O, ensuring easy visibility.
- Clean and minimalist layout to ensure focus on the game board. Centralize the board, display turn information clearly above or below.
- Subtle animations to indicate player turns and game outcomes, creating a more engaging experience.