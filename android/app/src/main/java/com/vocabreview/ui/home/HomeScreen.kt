package com.vocabreview.ui.home

import androidx.compose.animation.*
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.LocalFireDepartment
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.vocabreview.ui.components.GradientButton
import com.vocabreview.ui.components.SecondaryButton
import com.vocabreview.ui.theme.AppColors
import com.vocabreview.ui.theme.Spacing

@Composable
fun HomeScreen(
    onStartReview: () -> Unit,
    onNavigateVocabulary: (String) -> Unit,
    viewModel: HomeViewModel = viewModel()
) {
    val words by viewModel.words.collectAsStateWithLifecycle()
    val lastSyncAt by viewModel.lastSyncAt.collectAsStateWithLifecycle()
    val lastError by viewModel.lastError.collectAsStateWithLifecycle()
    val isLoading by viewModel.isLoading.collectAsStateWithLifecycle()

    // Trigger initial sync
    LaunchedEffect(Unit) {
        if (words.isNotEmpty() && lastSyncAt == null) {
            viewModel.syncGist()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = Spacing.xl, vertical = Spacing.xxl)
    ) {
        // Greeting
        Text(
            text = viewModel.greeting,
            style = MaterialTheme.typography.displayLarge
        )
        Spacer(Modifier.height(Spacing.xs))
        Text(
            text = "今天也要坚持复习哦",
            style = MaterialTheme.typography.bodyLarge,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f)
        )

        Spacer(Modifier.height(Spacing.xxl))

        // Stat cards
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(Spacing.md)
        ) {
            StatCard(
                icon = Icons.Default.LocalFireDepartment,
                value = viewModel.dueCount,
                title = "今日到期",
                color = AppColors.StatDue,
                onClick = onStartReview,
                modifier = Modifier.weight(1f)
            )
            StatCard(
                icon = Icons.Default.MenuBook,
                value = viewModel.learningCount,
                title = "学习中",
                color = AppColors.StatLearning,
                onClick = { onNavigateVocabulary("learning") },
                modifier = Modifier.weight(1f)
            )
            StatCard(
                icon = Icons.Default.CheckCircle,
                value = viewModel.masteredCount,
                title = "已掌握",
                color = AppColors.StatMastered,
                onClick = { onNavigateVocabulary("mastered") },
                modifier = Modifier.weight(1f)
            )
        }

        Spacer(Modifier.height(Spacing.xxxl))

        // Start review button
        GradientButton(
            text = "开始复习",
            onClick = onStartReview,
            enabled = viewModel.dueCount > 0
        )

        Spacer(Modifier.height(Spacing.md))

        // Sync button
        SecondaryButton(
            text = if (isLoading) "同步中..." else "同步 Gist",
            onClick = { viewModel.syncGist() },
            enabled = !isLoading
        )

        Spacer(Modifier.height(Spacing.lg))

        // Sync timestamp
        Text(
            text = lastSyncAt?.let { "上次同步: $it" } ?: "尚未同步",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f)
        )

        // Error message
        lastError?.let { error ->
            Spacer(Modifier.height(Spacing.sm))
            Text(
                text = error,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error
            )
        }
    }
}
