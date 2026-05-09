import { Image, Linking, Pressable, StyleSheet, Text, View } from 'react-native'
import { ProviderBadge } from './ProviderBadge'
import type { Film, StreamingProvider } from '@shared/types'
import { NEW_THRESHOLD_DAYS } from '@shared/constants'

interface Props {
  film: Film
  subscribedProviderIds: Set<number>
  showAllProviders: boolean
}

function isNew(firstSeenAt: string): boolean {
  return (Date.now() - new Date(firstSeenAt).getTime()) / (1000 * 60 * 60 * 24) <= NEW_THRESHOLD_DAYS
}

export function FilmCard({ film, subscribedProviderIds, showAllProviders }: Props) {
  const visibleProviders: StreamingProvider[] = showAllProviders
    ? film.providers
    : film.providers.filter(p => subscribedProviderIds.has(p.provider_id))

  const hasNewProvider = visibleProviders.some(p => isNew(p.first_seen_at))

  function handlePress() {
    Linking.openURL(`https://letterboxd.com/film/${film.letterboxd_slug}`)
  }

  return (
    <Pressable onPress={handlePress} style={styles.card}>
      {/* Poster */}
      <View style={styles.posterContainer}>
        {film.poster_url ? (
          <Image
            source={{ uri: film.poster_url }}
            style={styles.poster}
            resizeMode="cover"
            accessibilityLabel={film.title}
          />
        ) : (
          <View style={styles.posterPlaceholder}>
            <Text style={styles.posterPlaceholderText} numberOfLines={3}>
              {film.title}
            </Text>
          </View>
        )}

        {/* NEW badge */}
        {hasNewProvider && (
          <View style={styles.newBadge}>
            <Text style={styles.newBadgeText}>NEW</Text>
          </View>
        )}
      </View>

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={2}>{film.title}</Text>
        {film.year != null && (
          <Text style={styles.year}>{film.year}</Text>
        )}

        {/* Provider badges */}
        {visibleProviders.length > 0 && (
          <View style={styles.badges}>
            {visibleProviders.map(p => (
              <View key={p.provider_id} style={styles.badgeWrapper}>
                <ProviderBadge
                  logoPath={p.provider_logo_path}
                  providerName={p.provider_name}
                  size={24}
                />
                {isNew(p.first_seen_at) && (
                  <View style={styles.newDot} />
                )}
              </View>
            ))}
          </View>
        )}

        {visibleProviders.length === 0 && film.providers.length > 0 && !showAllProviders && (
          <Text style={styles.notOnServices}>Not on your services</Text>
        )}

        {film.providers.length === 0 && (
          <Text style={styles.notOnServices}>Not streaming</Text>
        )}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: '#18181b',
    borderRadius: 8,
    overflow: 'hidden',
  },
  posterContainer: {
    aspectRatio: 2 / 3,
    backgroundColor: '#27272a',
    position: 'relative',
  },
  poster: {
    width: '100%',
    height: '100%',
  },
  posterPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  posterPlaceholderText: {
    color: '#71717a',
    fontSize: 11,
    textAlign: 'center',
  },
  newBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#10b981',
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  newBadgeText: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  info: {
    padding: 6,
  },
  title: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '500',
    lineHeight: 15,
  },
  year: {
    color: '#71717a',
    fontSize: 10,
    marginTop: 2,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
    marginTop: 6,
  },
  badgeWrapper: {
    position: 'relative',
  },
  newDot: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#10b981',
    borderWidth: 1,
    borderColor: '#18181b',
  },
  notOnServices: {
    color: '#52525b',
    fontSize: 10,
    marginTop: 6,
  },
})
