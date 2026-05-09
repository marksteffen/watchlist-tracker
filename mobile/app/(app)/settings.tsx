import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
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
import { fetchStreamingProviders, validateUsername as apiValidateUsername } from '@/lib/api'
import { syncAll } from '@/lib/sync'
import { ProviderPicker } from '@/components/ProviderPicker'
import { Spinner } from '@/components/Spinner'

interface ProviderWithLogo {
  provider_id: number
  provider_name: string
  logo_url: string | null
}

export default function SettingsScreen() {
  const { session } = useSession()

  const [loading, setLoading] = useState(true)
  const [initialUsername, setInitialUsername] = useState('')
  const [username, setUsername] = useState('')
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle')
  const [providers, setProviders] = useState<ProviderWithLogo[]>([])
  const [loadingProviders, setLoadingProviders] = useState(true)
  const [selectedIds, setSelectedIds] = useState<number[]>([])
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')
  const [error, setError] = useState('')

  const validatingRef = useRef('')
  const lastValidatedUsername = useRef('')

  // Load current user data on mount
  useEffect(() => {
    if (!session) {
      setLoading(false)
      return
    }

    async function loadUserData() {
      const { data } = await supabase
        .from('users')
        .select('letterboxd_username, streaming_subscriptions')
        .eq('id', session!.user.id)
        .single()

      if (data?.letterboxd_username) {
        setInitialUsername(data.letterboxd_username)
        setUsername(data.letterboxd_username)
        lastValidatedUsername.current = data.letterboxd_username
      }

      if (Array.isArray(data?.streaming_subscriptions)) {
        setSelectedIds(data.streaming_subscriptions.map(Number))
      }

      setLoading(false)
    }

    loadUserData()
  }, [session])

  // Load providers
  useEffect(() => {
    fetchStreamingProviders().then((data) => {
      setProviders(data)
      setLoadingProviders(false)
    })
  }, [])

  // Derive effective username status: if unchanged from DB, treat as valid
  function getEffectiveStatus() {
    if (username.trim() === initialUsername.trim() && initialUsername.trim() !== '') {
      return 'valid'
    }
    return usernameStatus
  }

  async function handleValidate() {
    const trimmed = username.trim()
    if (!trimmed) return

    // If unchanged from initial, skip validation
    if (trimmed === initialUsername.trim() && initialUsername.trim() !== '') {
      setUsernameStatus('valid')
      lastValidatedUsername.current = trimmed
      return
    }

    if (trimmed === lastValidatedUsername.current && usernameStatus === 'valid') return

    validatingRef.current = trimmed
    setUsernameStatus('checking')
    const valid = await apiValidateUsername(trimmed)
    // Only apply result if username hasn't changed since this request was fired
    if (validatingRef.current === trimmed) {
      setUsernameStatus(valid ? 'valid' : 'invalid')
      if (valid) {
        lastValidatedUsername.current = trimmed
      }
    }
  }

  function handleUsernameChange(text: string) {
    setUsername(text)
    setSaveMessage('')
    if (usernameStatus !== 'idle') {
      setUsernameStatus('idle')
    }
    // Invalidate any in-flight validation
    validatingRef.current = ''
  }

  function toggleProvider(id: number) {
    setSaveMessage('')
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  async function handleSave() {
    setError('')
    setSaveMessage('')

    const effectiveStatus = getEffectiveStatus()

    if (!username.trim()) {
      setError('Please enter your Letterboxd username.')
      return
    }
    if (effectiveStatus === 'idle' || effectiveStatus === 'checking') {
      setError('Please validate your Letterboxd username first.')
      return
    }
    if (effectiveStatus === 'invalid') {
      setError("That Letterboxd username wasn't found. Please check it and try again.")
      return
    }
    if (selectedIds.length === 0) {
      setError('Please select at least one streaming service.')
      return
    }

    if (!session) return
    setSaving(true)

    try {
      const trimmedUsername = username.trim()
      const { error: dbError } = await supabase
        .from('users')
        .update({
          letterboxd_username: trimmedUsername,
          streaming_subscriptions: selectedIds.map(String),
        })
        .eq('id', session.user.id)

      if (dbError) {
        setError('Failed to save: ' + dbError.message)
        setSaving(false)
        return
      }

      const usernameChanged = trimmedUsername !== initialUsername.trim()

      if (usernameChanged) {
        // New username = new watchlist, trigger sync (non-fatal)
        await syncAll(session.access_token)
        setInitialUsername(trimmedUsername)
        lastValidatedUsername.current = trimmedUsername
      }

      setSaveMessage('Saved')
      setTimeout(() => setSaveMessage(''), 3000)
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleSignOut() {
    await supabase.auth.signOut()
    // No manual navigation — SessionProvider fires SIGNED_OUT, layout redirects
  }

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color="#10b981" />
      </View>
    )
  }

  const effectiveStatus = getEffectiveStatus()
  const canSave =
    !saving &&
    effectiveStatus === 'valid' &&
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
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backBtnText}>← Back</Text>
          </Pressable>
          <Text style={styles.headerTitle}>Settings</Text>
          <View style={styles.headerRight} />
        </View>

        {/* Username section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Letterboxd username</Text>
          <Text style={styles.sectionDesc}>
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

          {effectiveStatus === 'valid' && (
            <Text style={styles.statusValid}>Username found</Text>
          )}
          {effectiveStatus === 'invalid' && (
            <Text style={styles.statusInvalid}>Username not found or watchlist is private</Text>
          )}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Providers section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Streaming services</Text>
          <Text style={styles.sectionDesc}>
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

        {/* Divider */}
        <View style={styles.divider} />

        {/* Error */}
        {!!error && (
          <Text style={styles.errorText}>{error}</Text>
        )}

        {/* Save button */}
        <Pressable
          style={[styles.saveBtn, !canSave && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={!canSave}
        >
          {saving ? (
            <ActivityIndicator color="#000" />
          ) : (
            <Text style={styles.saveBtnText}>Save settings</Text>
          )}
        </Pressable>

        {!!saveMessage && (
          <Text style={styles.saveMessage}>{saveMessage}</Text>
        )}

        {/* Divider */}
        <View style={styles.divider} />

        {/* Sign out section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Pressable style={styles.signOutBtn} onPress={handleSignOut}>
            <Text style={styles.signOutBtnText}>Sign out</Text>
          </Pressable>
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
  scroll: {
    flex: 1,
  },
  content: {
    paddingBottom: 60,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#09090b',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: '#27272a',
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  backBtn: {
    minWidth: 60,
  },
  backBtnText: {
    color: '#a1a1aa',
    fontSize: 14,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  headerRight: {
    minWidth: 60,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 20,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  sectionDesc: {
    color: '#a1a1aa',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  divider: {
    height: 1,
    backgroundColor: '#27272a',
    marginHorizontal: 0,
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
    marginHorizontal: 16,
    marginBottom: 12,
  },
  saveBtn: {
    backgroundColor: '#10b981',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 12,
  },
  saveBtnDisabled: {
    opacity: 0.5,
  },
  saveBtnText: {
    color: '#000',
    fontSize: 16,
    fontWeight: '600',
  },
  saveMessage: {
    color: '#34d399',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },
  signOutBtn: {
    backgroundColor: '#27272a',
    borderWidth: 1,
    borderColor: '#3f3f46',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutBtnText: {
    color: '#f87171',
    fontSize: 15,
    fontWeight: '500',
  },
})
