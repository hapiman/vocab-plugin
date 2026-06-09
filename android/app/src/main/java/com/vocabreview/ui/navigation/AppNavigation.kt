package com.vocabreview.ui.navigation

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Book
import androidx.compose.material.icons.filled.Layers
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.navigation.NavDestination.Companion.hierarchy
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.vocabreview.ui.detail.WordDetailScreen
import com.vocabreview.ui.home.HomeScreen
import com.vocabreview.ui.review.ReviewScreen
import com.vocabreview.ui.settings.SettingsScreen
import com.vocabreview.ui.vocabulary.VocabularyScreen

sealed class Screen(val route: String, val label: String, val icon: ImageVector) {
    data object Home : Screen("home", "复习", Icons.Default.Layers)
    data object Vocabulary : Screen("vocabulary/{mode}", "词库", Icons.Default.Book) {
        fun withMode(mode: String = "learning") = "vocabulary/$mode"
    }
    data object Settings : Screen("settings", "设置", Icons.Default.Settings)
    data object Review : Screen("review", "", Icons.Default.Layers)
    data object WordDetail : Screen("word_detail/{word}", "", Icons.Default.Book) {
        fun withWord(word: String) = "word_detail/${java.net.URLEncoder.encode(word, "UTF-8")}"
    }
}

private val bottomNavItems = listOf(Screen.Home, Screen.Vocabulary, Screen.Settings)

@Composable
fun AppNavigation() {
    val navController = rememberNavController()

    Scaffold(
        bottomBar = {
            val navBackStackEntry by navController.currentBackStackEntryAsState()
            val currentDestination = navBackStackEntry?.destination

            // Hide bottom bar on review and detail screens
            val showBottomBar = currentDestination?.route?.let {
                it != Screen.Review.route && !it.startsWith("word_detail")
            } ?: true

            if (showBottomBar) {
                NavigationBar {
                    bottomNavItems.forEach { screen ->
                        val selected = currentDestination?.hierarchy?.any {
                            it.route == screen.route || it.route?.startsWith(screen.route.substringBefore("/")) == true
                        } == true

                        NavigationBarItem(
                            icon = { Icon(screen.icon, contentDescription = screen.label) },
                            label = { Text(screen.label) },
                            selected = selected,
                            onClick = {
                                val route = if (screen == Screen.Vocabulary) {
                                    Screen.Vocabulary.withMode("learning")
                                } else screen.route

                                navController.navigate(route) {
                                    popUpTo(navController.graph.findStartDestination().id) {
                                        saveState = true
                                    }
                                    launchSingleTop = true
                                    restoreState = true
                                }
                            }
                        )
                    }
                }
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = Screen.Home.route,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(Screen.Home.route) {
                HomeScreen(
                    onStartReview = { navController.navigate(Screen.Review.route) },
                    onNavigateVocabulary = { mode ->
                        navController.navigate(Screen.Vocabulary.withMode(mode))
                    }
                )
            }

            composable(
                route = Screen.Vocabulary.route,
                arguments = listOf(navArgument("mode") { type = NavType.StringType })
            ) { backStackEntry ->
                val mode = backStackEntry.arguments?.getString("mode") ?: "learning"
                VocabularyScreen(
                    mode = mode,
                    onWordClick = { word ->
                        navController.navigate(Screen.WordDetail.withWord(word))
                    },
                    onNavigateMastered = {
                        navController.navigate(Screen.Vocabulary.withMode("mastered"))
                    }
                )
            }

            composable(Screen.Settings.route) {
                SettingsScreen()
            }

            composable(Screen.Review.route) {
                ReviewScreen(onBack = { navController.popBackStack() })
            }

            composable(
                route = Screen.WordDetail.route,
                arguments = listOf(navArgument("word") { type = NavType.StringType })
            ) { backStackEntry ->
                val word = backStackEntry.arguments?.getString("word")?.let {
                    java.net.URLDecoder.decode(it, "UTF-8")
                } ?: ""
                WordDetailScreen(word = word, onBack = { navController.popBackStack() })
            }
        }
    }
}
