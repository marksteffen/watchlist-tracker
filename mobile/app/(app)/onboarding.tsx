import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import { router } from 'expo-router'
import { useSession } from '@/lib/session'
import { supabase } from '@/lib/supabase'
import { fetchStreamingProviders, syncWatchlist, validateUsername as apiValidateUsername } from '@/lib/api'
import { ProviderPicker } from '@/components/ProviderPicker'
import { Spinner } from '@/components/Spinner'

interface ProviderWithLogo {
  provider_id: number
  provider_name: string
  logo_url: string | null
}

export default function OnboardingScreen() {
  const { session } = useSession()

  const [checkingOnboarded, setCheckingOnboarded] = useState(true)
  const [username, setUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle')
  const [providers, setProviders] = useState<ProviderWithLogo[]>([])
  const [loadingProviders, setLoadingProviders] = useState(true)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  const lastValidatedUsername = useRef('')
  const validatingRef = useRef('')

  // On mount: check if already onboarded
  useEffect(() => {
    if (!session) {
      setCheckingOnboarded(false)
      return
    }

    async function checkOnboarded() {
      const { data } = await supabase
        .from('users')
        .select('letterboxd_username, streaming_subscriptions')
        .eq('id', session!.user.id)
        .single()

      if (
        data?.letterboxd_username &&
        Array.isArray(data.streaming_subscriptions) &&
        data.streaming_subscriptions.length > 0
      ) {
        router.replace('/(app)/')
        return
      }

      // Pre-fill if partially saved
      if (data?.letterboxd_username) {
        setUsername(data.letterboxd_username)
        setUsernameStatus('valid')
        lastValidatedUsername.current = data.letterboxd_username
      }
      if (Array.isArray(data?.streaming_subscriptions)) {
        setSelectedIds(data.streaming_subscriptions.map(Number))
      }

      setCheckingOnboarded(false)
    }

    checkOnboarded()
  }, [session])

  // Load providers once
  useEffect(() => {
    fetchStreamingProviders().then((data) => {
      setProviders(data)
      setLoadingProviders(false)
    })
  }, [])

  async function handleValidate() {
    const trimmed = username.trim()
    if (!trimmed) return
    if (trimmed === lastValidatedUsername.current && usernameStatus === 'valid') return

    validatingRef.current = trimmed
    setUsernameStatus('checking')
    const valid = await apiValidateUsername(trimmed)
    // Only apply result if the username hasn't changed since this request was fired
    if (validatingRef.current === trimmed) {
      setUsernameStatus(valid ? 'valid' : 'invalid')
      if (valid) {
        lastValidatedUsername.current = trimmed
      }
    }
  }

  function handleUsernameChange(text: string) {
    setUsername(text)
    if (usernameStatus !== 'idle') {
      setUsernameStatus('idle')
    }
    // Invalidate any in-flight validation so its result won't be applied
    validatingRef.current = ''
  }

  function toggleProvider(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  async function handleSubmit() {
    setError('')

    if (!username.trim()) {
      setError('Please enter your Letterboxd username.')
      return
    }
    if (usernameStatus === 'idle' || usernameStatus === 'checking') {
      setError('Please validate your Letterboxd username first.')
      return
    }
    if (usernameStatus === 'invalid') {
      setError("That Letterboxd username wasn't found. Please check it and try again.")
      return
    }
    if (selectedIds.length === 0) {
      setError('Please select at least one streaming service.')
      return
    }

    if (!session) return
    setSubmitting(true)

    try {
      const { error: dbError } = await supabase
        .from('users')
        .update({
          letterboxd_username: username.trim(),
          streaming_subscriptions: selectedIds.map(String),
        })
        .eq('id', session.user.id)

      if (dbError) {
        setError('Failed to save: ' + dbError.message)
        setSubmitting(false)
        return
      }

      // Kick off watchlist sync; navigate regardless of result
      const syncResult = await syncWatchlist(session.access_token)
      if (!syncResult.ok) {
        // Non-fatal — user can retry from dashboard
        Alert.alert(
          'Sync note',
          'Your account was saved but the initial watchlist sync failed. You can retry from the dashboard.',
          [{ text: 'OK' }]
        )
      }

      router.replace('/(app)/')
    } catch {
      setError('An unexpected error occurred. Please try again.')
      setSubmitting(false)
    }
  }

  if (checkingOnboarded) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#10b981" />
      </View>
    )
  }

  const canSubmit =
    !submitting &&
    usernameStatus === 'valid' &&
    selectedIds.length > 0

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Streamlist</Text>
        </View>

        {/* Intro */}
        <View style={styles.intro}>
          <Text style={styles.introHeading}>Welcome! Let's set up your account.</Text>
          <Text style={styles.introSub}>
            Just two quick steps and your dashboard will be ready to go.
          </Text>
        </View>

        {/* Step 1: Username */}
        <View style={styles.section}>
          <View style={styles.stepHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>1</Text>
            </View>
            <Text style={styles.stepTitle}>Your Letterboxd username</Text>
          </View>
          <Text style={styles.stepDesc}>
            Your watchlist must be public. We'll use it to track streaming availability.
          </Text>

          <View style={styles.usernameRow}>
            <View style={styles.inputWrapper}>
              <Text style={styles.inputPrefix}>letterboxd.com/</Text>
              <TextInput
                style={styles.input}
                value={username}
                onChangeText={handleUsernameChange}
                onBlur={handleValidate}
                placeholder="yourname"
                placeholderTextColor="#71717a"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleValidate}
              />
            </View>
            <Pressable
              style={[styles.checkBtn, usernameStatus === 'checking' && styles.checkBtnDisabled]}
              onPress={handleValidate}
              disabled={usernameStatus === 'checking'}
            >
              {usernameStatus === 'checking' ? (
                <Spinner />
              ) : (
                <Text style={styles.checkBtnText}>Check</Text>
              )}
            </Pressable>
          </View>

          {usernameStatus === 'valid' && (
            <Text style={styles.statusValid}>Username found</Text>
          )}
          {usernameStatus === 'invalid' && (
            <Text style={styles.statusInvalid}>Username not found or watchlist is private</Text>
          )}
        </View>

        {/* Step 2: Providers */}
        <View style={styles.section}>
          <View style={styles.stepHeader}>
            <View style={styles.stepBadge}>
              <Text style={styles.stepBadgeText}>2</Text>
            </View>
            <Text style={styles.stepTitle}>Your streaming services</Text>
          </View>
          <Text style={styles.stepDesc}>
            Select every service you subscribe to. Your dashboard will highlight films available on these.
          </Text>

          {loadingProviders ? (
            <View style={styles.providersLoading}>
              <ActivityIndicator color="#10b981" />
            </View>
          ) : (
            <ProviderPicker
              providers={providers}
              selectedIds={selectedIds}
              onToggle={toggleProvider}
            />
          )}
        </View>

        {/* Error */}
        {!!error && (
          <Text style={styles.errorText}>{error}</Text>
        )}

        {/* Submit */}
        <Pressable
          style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit}
        >
          {submitting ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.submitBtnText}>Go to my dashboard</Text>
          )}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#09090b',
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#09090b',
  },
  header: {
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    paddingVertical: 16,
    marginHorizontal: -16,
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  intro: {
    marginBottom: 32,
  },
  introHeading: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 6,
  },
  introSub: {
    color: '#a1a1aa',
    fontSize: 14,
    lineHeight: 20,
  },
  section: {
    marginBottom: 32,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#10b981',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepBadgeText: {
    color: '#000',
    fontSize: 12,
    fontWeight: '700',
  },
  stepTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  stepDesc: {
    color: '#a1a1aa',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
    marginLeft: 32,
  },
  usernameRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'stretch',
  },
  inputWrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  inputPrefix: {
    color: '#71717a',
    fontSize: 13,
  },
  input: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    paddingVertical: 12,
  },
  checkBtn: {
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 72,
  },
  checkBtnDisabled: {
    opacity: 0.6,
  },
  checkBtnText: {
    color: '#d4d4d8',
    fontSize: 14,
    fontWeight: '500',
  },
  statusValid: {
    color: '#34d399',
    fontSize: 13,
    marginTop: 6,
    marginLeft: 4,
  },
  statusInvalid: {
    color: '#f87171',
    fontSize: 13,
    marginTop: 6,
    marginLeft: 4,
  },
  providersLoading: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  errorText: {
    color: '#f87171',
    fontSize: 14,
    marginBottom: 16,
  },
  submitBtn: {
    backgroundColor: '#10b981',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  submitBtnDisabled: {
    opacity: 0.5,
  },
  submitBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
})
