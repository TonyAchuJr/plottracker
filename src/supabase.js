import { createClient } from '@supabase/supabase-js'

<<<<<<< HEAD
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY
=======
const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseKey = process.env.REACT_APP_SUPABASE_ANON_KEY
>>>>>>> b862cb31 (Connect Supabase and update registration)

export const supabase = createClient(
  supabaseUrl,
  supabaseKey
<<<<<<< HEAD
)
=======
)
>>>>>>> b862cb31 (Connect Supabase and update registration)
