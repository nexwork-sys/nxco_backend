import { Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

/**
 * Shows a native chooser between "Take Photo" and "Choose from Gallery",
 * requesting the right permission for whichever the person picks (instead
 * of only ever offering gallery access, and instead of relying on
 * launch*Async's implicit permission prompt, which some Android/iOS
 * versions handle inconsistently).
 *
 * Resolves to an ImagePicker asset ({ uri, ... }) or null if cancelled/denied.
 */
export function pickImage({ quality = 0.7 } = {}) {
    return new Promise(resolve => {
        Alert.alert('Add Photo', 'Take a new photo or choose one from your gallery?', [
            { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
            {
                text: '📷 Take Photo',
                onPress: async () => {
                    const perm = await ImagePicker.requestCameraPermissionsAsync();
                    if (!perm.granted) {
                        Alert.alert('Camera permission needed', 'Enable camera access in your phone Settings to take a photo.');
                        return resolve(null);
                    }
                    const result = await ImagePicker.launchCameraAsync({ quality, mediaTypes: ImagePicker.MediaTypeOptions.Images });
                    resolve(result.canceled ? null : result.assets[0]);
                },
            },
            {
                text: '🖼️ Choose from Gallery',
                onPress: async () => {
                    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
                    if (!perm.granted) {
                        Alert.alert('Photo library permission needed', 'Enable photo access in your phone Settings to choose an image.');
                        return resolve(null);
                    }
                    const result = await ImagePicker.launchImageLibraryAsync({ quality, mediaTypes: ImagePicker.MediaTypeOptions.Images });
                    resolve(result.canceled ? null : result.assets[0]);
                },
            },
        ]);
    });
}
