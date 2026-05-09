import { FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native'
import type { ProviderWithLogo } from '@/lib/api'

interface Props {
  providers: ProviderWithLogo[]
  selectedIds: number[]
  onToggle: (id: number) => void
}

export function ProviderPicker({ providers, selectedIds, onToggle }: Props) {
  const selectedSet = new Set(selectedIds)

  return (
    <FlatList
      data={providers}
      keyExtractor={(item) => String(item.provider_id)}
      numColumns={3}
      scrollEnabled={false}
      columnWrapperStyle={styles.row}
      renderItem={({ item }) => {
        const selected = selectedSet.has(item.provider_id)
        return (
          <Pressable
            onPress={() => onToggle(item.provider_id)}
            style={[styles.item, selected ? styles.itemSelected : styles.itemUnselected]}
          >
            {item.logo_url ? (
              <Image
                source={{ uri: item.logo_url }}
                style={styles.logo}
                resizeMode="cover"
              />
            ) : (
              <View style={styles.logoPlaceholder} />
            )}
            <Text
              style={[styles.name, selected ? styles.nameSelected : styles.nameUnselected]}
              numberOfLines={2}
            >
              {item.provider_name}
            </Text>
            {selected && (
              <Text style={styles.checkmark}>✓</Text>
            )}
          </Pressable>
        )
      }}
    />
  )
}

const styles = StyleSheet.create({
  row: {
    gap: 8,
    marginBottom: 8,
  },
  item: {
    flex: 1,
    alignItems: 'center',
    padding: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    minHeight: 80,
    justifyContent: 'center',
    gap: 6,
  },
  itemSelected: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: '#10b981',
  },
  itemUnselected: {
    backgroundColor: '#27272a',
    borderColor: '#3f3f46',
  },
  logo: {
    width: 36,
    height: 36,
    borderRadius: 6,
  },
  logoPlaceholder: {
    width: 36,
    height: 36,
    borderRadius: 6,
    backgroundColor: '#3f3f46',
  },
  name: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
  },
  nameSelected: {
    color: '#6ee7b7',
  },
  nameUnselected: {
    color: '#a1a1aa',
  },
  checkmark: {
    position: 'absolute',
    top: 6,
    right: 8,
    color: '#10b981',
    fontSize: 10,
    fontWeight: 'bold',
  },
})
