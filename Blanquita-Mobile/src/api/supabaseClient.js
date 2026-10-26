import { createClient } from "@supabase/supabase-js";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CONFIG } from "../constants/Config";

/**
 * Cliente de Supabase para React Native con persistencia en AsyncStorage
 * Permite suscripciones en tiempo real y consultas directas a la base de datos central
 */
export const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
