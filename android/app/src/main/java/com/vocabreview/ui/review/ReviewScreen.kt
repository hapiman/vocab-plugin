package com.vocabreview.ui.review

import androidx.compose.animation.core.Animatable
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.Celebration
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.vocabreview.ui.components.EmptyState
import com.vocabreview.ui.components.SecondaryButton
import com.vocabreview.ui.theme.AppColors
import com.vocabreview.ui.theme.Radius
import com.vocabreview.ui.theme.Spacing
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReviewScreen(
    onBack: () -> Unit,
    viewModel: ReviewViewModel = viewModel()
) {
    val scope = rememberCoroutineScope()
    val density = LocalDensity.current

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(viewModel.progress) },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
                    }
                }
            )
        }
    ) { padding ->
        if (viewModel.isQueueEmpty) {
            EmptyState(
                icon = Icons.Default.Celebration,
                title = "全部复习完毕",
                message = "今天的复习任务已完成，继续保持！",
                modifier = Modifier.padding(padding)
            )
            return@Scaffold
        }

        val currentWord = viewModel.currentWord ?: return@Scaffold
        val offsetX = remember { Animatable(0f) }
        val swipeRange = with(density) { 160.dp.toPx() }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = Spacing.xl),
            horizontalAlignment = Alignment.CenterHorizontally
        ) {
            Spacer(Modifier.height(Spacing.lg))

            // Flash card with swipe gesture
            Box(
                modifier = Modifier
                    .weight(1f)
                    .graphicsLayer {
                        // Subtle drag feedback: card follows the finger softly,
                        // fading and shrinking slightly as it leaves the center.
                        val progress = (kotlin.math.abs(offsetX.value) / swipeRange).coerceIn(0f, 1f)
                        translationX = offsetX.value * 0.3f
                        alpha = 1f - progress * 0.25f
                        scaleX = 1f - progress * 0.04f
                        scaleY = 1f - progress * 0.04f
                    }
                    .pointerInput(viewModel.currentIndex) {
                        detectHorizontalDragGestures(
                            onDragEnd = {
                                val threshold = with(density) { 50.dp.toPx() }
                                when {
                                    offsetX.value > threshold -> viewModel.previous()
                                    offsetX.value < -threshold -> viewModel.next()
                                }
                                // Spring back to center instead of a hard snap.
                                scope.launch {
                                    offsetX.animateTo(0f, animationSpec = spring())
                                }
                            },
                            onDragCancel = {
                                scope.launch {
                                    offsetX.animateTo(0f, animationSpec = spring())
                                }
                            },
                            onHorizontalDrag = { _, dragAmount ->
                                scope.launch {
                                    offsetX.snapTo(offsetX.value + dragAmount)
                                }
                            }
                        )
                    }
            ) {
                FlashCard(
                    word = currentWord.first,
                    vocabWord = currentWord.second,
                    isFlipped = viewModel.isFlipped,
                    onClick = { viewModel.flip() },
                    modifier = Modifier.fillMaxSize()
                )

                // Mastered overlay
                if (viewModel.showMasteredOverlay) {
                    MasteredOverlay()
                    LaunchedEffect(Unit) {
                        delay(800)
                        viewModel.advanceAfterMastered()
                    }
                }
            }

            Spacer(Modifier.height(Spacing.lg))

            // Action buttons (always visible, always tappable)
            ReviewActions(
                onMiss = { viewModel.complete(com.vocabreview.model.ReviewOutcome.MISS) },
                onHard = { viewModel.complete(com.vocabreview.model.ReviewOutcome.HARD) },
                onGood = { viewModel.complete(com.vocabreview.model.ReviewOutcome.GOOD) }
            )

            Spacer(Modifier.height(Spacing.md))

            // Toggle mastered button
            SecondaryButton(
                text = if (currentWord.second.status == "mastered") "重新学习" else "标记已掌握",
                onClick = { viewModel.toggleMastered() }
            )

            Spacer(Modifier.height(Spacing.md))

            // Hint
            Text(
                text = "点击卡片翻转 · 左右滑动切换",
                fontSize = 12.sp,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f),
                textAlign = TextAlign.Center
            )

            Spacer(Modifier.height(Spacing.lg))
        }
    }
}

@Composable
private fun MasteredOverlay() {
    val scale by animateFloatAsState(targetValue = 1f, animationSpec = tween(250), label = "scale")

    Box(
        modifier = Modifier
            .fillMaxSize()
            .clip(RoundedCornerShape(Radius.large))
            .background(AppColors.StatMastered.copy(alpha = 0.3f)),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Icon(
                imageVector = Icons.Default.CheckCircle,
                contentDescription = null,
                modifier = Modifier.size(48.dp).scale(scale),
                tint = AppColors.StatMastered
            )
            Spacer(Modifier.height(Spacing.sm))
            Text(
                text = "已掌握",
                fontSize = 18.sp,
                fontWeight = FontWeight.Bold,
                color = AppColors.StatMastered
            )
        }
    }
}
