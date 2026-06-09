package com.vocabreview

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.vocabreview.ui.navigation.AppNavigation
import com.vocabreview.ui.theme.VocabReviewTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            VocabReviewTheme(dynamicColor = false) {
                AppNavigation()
            }
        }
    }
}
