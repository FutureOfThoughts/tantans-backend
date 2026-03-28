// src/services/authService.js
const { supabase } = require('../config/supabase');

const signup = async ({ email, password, first_name, last_name, phone }) => {
  let authUser = null;

  try {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) throw new Error(authError.message);

    authUser = authData.user;

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authUser.id,
        first_name,
        last_name,
        phone: phone || null
      })
      .select()
      .single();

    if (profileError) throw new Error(profileError.message);

    // Sign in to get a session after creating the user
    const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (sessionError) throw new Error(sessionError.message);

    return { user: authUser, profile, session: sessionData.session };

  } catch (error) {
    if (authUser) {
      await supabase.auth.admin.deleteUser(authUser.id);
    }
    throw error;
  }
};

module.exports = { signup };