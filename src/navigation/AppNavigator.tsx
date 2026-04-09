import { Ionicons } from "@expo/vector-icons";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { ActivityIndicator, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CalendarScreen } from "@/screens/CalendarScreen";
import { DetailAnalysisScreen } from "@/screens/DetailAnalysisScreen";
import { HomeScreen } from "@/screens/HomeScreen";
import { QuickRecordScreen } from "@/screens/QuickRecordScreen";
import { SettingsScreen } from "@/screens/SettingsScreen";
import { useAppState } from "@/state/AppProvider";
import { colors } from "@/theme/colors";

export type RootTabParamList = {
  Home: undefined;
  Detail: undefined;
  Calendar: undefined;
  QuickRecord: undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<RootTabParamList>();

const icons: Record<keyof RootTabParamList, keyof typeof Ionicons.glyphMap> = {
  Home: "home-outline",
  Detail: "analytics-outline",
  Calendar: "calendar-outline",
  QuickRecord: "mic-outline",
  Settings: "settings-outline",
};

export function AppNavigator() {
  const { ready } = useAppState();
  const insets = useSafeAreaInsets();

  if (!ready) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator size="large" color={colors.accent} />
      </View>
    );
  }

  return (
    <Tab.Navigator
      sceneContainerStyle={{
        backgroundColor: colors.background,
      }}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          height: 56 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom,
          borderTopColor: colors.border,
          backgroundColor: "#08111D",
        },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={icons[route.name]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: "ホーム" }} />
      <Tab.Screen name="Detail" component={DetailAnalysisScreen} options={{ title: "解析" }} />
      {/* QuickRecord: 音声入力が安定したら復活 → <Tab.Screen name="QuickRecord" component={QuickRecordScreen} options={{ title: "クイック記録" }} /> */}
      <Tab.Screen name="Calendar" component={CalendarScreen} options={{ title: "記録" }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: "設定" }} />
    </Tab.Navigator>
  );
}
