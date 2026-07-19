# SpaceSync

**Live Demo:** [spacesyncweb.netlify.app](https://spacesyncweb.netlify.app)

SpaceSync is a real-time collaborative web application designed to help roommates seamlessly manage their shared living spaces. It provides instant synchronization for supplies, chores, and to-do lists, ensuring everyone in the house stays on the same page.

## Features

- **Real-time Synchronization:** Powered by Supabase Realtime, any changes made to supplies or chores are instantly reflected across all connected clients.
- **Roommate Management:** Join a house using a unique code and claim your slot.
- **Supply Tracking:** Keep track of household supplies, who bought them last, and easily split costs.
- **Shared To-Do List:** Assign and track recurring chores or one-off tasks among roommates.
- **Modern UI:** Built with a sleek, responsive interface using React and Tailwind CSS.

## Tech Stack

- **Frontend:** React (Hooks), Vite, Tailwind CSS, React Router DOM, Lucide React (Icons)
- **Backend/Database:** Supabase, PostgreSQL (with Row Level Security and Realtime WebSockets)

## Getting Started

### Prerequisites
- Node.js installed on your machine
- A Supabase account and project

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/A2Studios/SpaceSync.git
   cd SpaceSync
   ```

2. Install the dependencies:
   ```bash
   npm install
   ```

3. Set up the database:
   - Run the SQL commands in `schema.sql` in your Supabase project's SQL editor to set up the necessary tables (`houses`, `roommates`, `supplies`, `todos`) and policies.

4. Configure environment variables:
   - Create a `.env.local` file in the root directory.
   - Add your Supabase URL and Anon Key:
     ```env
     VITE_SUPABASE_URL=your_supabase_url
     VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
     ```

5. Start the development server:
   ```bash
   npm run dev
   ```
   The app should now be running locally on the port provided by Vite (usually `http://localhost:5173`).

## Building for Production

To create a production build, run:
```bash
npm run build
```

## License
MIT License
