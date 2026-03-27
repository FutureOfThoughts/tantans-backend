const { supabase } = require('../config/supabase');

const signup = async ({ email, password, first_name, last_name, phone }) => {
  let authUser = null;

  try {
    // Step 1 — create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) throw new Error(authError.message);

    authUser = authData.user;

    // Step 2 — create profile
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

    return { user: authUser, profile };

  } catch (error) {
    // Rollback — delete auth user if profile creation failed
    if (authUser) {
      await supabase.auth.admin.deleteUser(authUser.id);
    }
    throw error;
  }
};

module.exports = { signup };