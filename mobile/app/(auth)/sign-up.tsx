import { useState } from 'react'
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native'
import { router } from 'expo-router'
import { supabase } from '@/lib/supabase'
import { Spinner } from '@/components/Spinner'

export default function SignUp() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  async function handleSubmit() {
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signUp({ email, password })
    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }
    if (!data.session) {
      // Email confirmation required
      setConfirmed(true)
      setLoading(false)
      return
    }
    // If session is set: do nothing — session change drives the redirect automatically
  }

  if (confirmed) {
    return (
      <View style={styles.container}>
        <View style={styles.inner}>
          <Text style={styles.title}>Check your email</Text>
          <Text style={styles.confirmText}>
            Check your email to confirm your account before signing in.
          </Text>
          <TouchableOpacity
            style={styles.button}
            onPress={() => router.push('/(auth)/sign-in')}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>Back to sign in</Text>
          </TouchableOpacity>
        </View>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.inner}>
          <View style={styles.header}>
            <Text style={styles.title}>Create account</Text>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Email address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor="#71717a"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••"
                placeholderTextColor="#71717a"
                secureTextEntry
                editable={!loading}
              />
              <Text style={styles.hint}>Minimum 6 characters</Text>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? <Spinner /> : <Text style={styles.buttonText}>Create account</Text>}
            </TouchableOpacity>
          </View>

          <Text style={styles.footer}>
            Already have an account?{' '}
            <Text
              style={styles.link}
              onPress={() => router.push('/(auth)/sign-in')}
            >
              Sign in
            </Text>
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  container: {
    flex: 1,
    backgroundColor: '#09090b',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  inner: {
    width: '100%',
    maxWidth: 384,
    alignSelf: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    marginTop: 16,
    textAlign: 'center',
  },
  confirmText: {
    color: '#a1a1aa',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 32,
    lineHeight: 24,
  },
  form: {
    gap: 16,
  },
  field: {
    gap: 4,
  },
  label: {
    fontSize: 14,
    color: '#a1a1aa',
    marginBottom: 4,
  },
  input: {
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    color: '#ffffff',
    fontSize: 16,
  },
  hint: {
    fontSize: 12,
    color: '#71717a',
    marginTop: 4,
  },
  error: {
    color: '#f87171',
    fontSize: 14,
  },
  button: {
    backgroundColor: '#10b981',
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 46,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#000000',
    fontWeight: '600',
    fontSize: 16,
  },
  footer: {
    textAlign: 'center',
    color: '#71717a',
    fontSize: 14,
    marginTop: 24,
  },
  link: {
    color: '#34d399',
  },
})
