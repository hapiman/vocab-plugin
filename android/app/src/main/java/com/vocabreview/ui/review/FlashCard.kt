package com.vocabreview.ui.review

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vocabreview.model.VocabWord
import com.vocabreview.ui.theme.AppColors
import com.vocabreview.ui.theme.Radius
import com.vocabreview.ui.theme.Spacing

@Composable
fun FlashCard(
    word: String,
    vocabWord: VocabWord,
    isFlipped: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val rotation by animateFloatAsState(
        targetValue = if (isFlipped) 180f else 0f,
        animationSpec = tween(400),
        label = "flip"
    )

    Box(
        modifier = modifier
            .fillMaxWidth()
            .aspectRatio(0.7f, matchHeightConstraintsFirst = true)
            .shadow(
                elevation = 6.dp,
                shape = RoundedCornerShape(Radius.large),
                ambientColor = Color.Black.copy(alpha = 0.06f),
                spotColor = Color.Black.copy(alpha = 0.10f)
            )
            .clip(RoundedCornerShape(Radius.large))
            .graphicsLayer {
                rotationY = rotation
                cameraDistance = 12f * density
            }
            .background(MaterialTheme.colorScheme.surface)
            .clickable(onClick = onClick)
    ) {
        if (rotation <= 90f) {
            // Front side
            CardFront(word = word, vocabWord = vocabWord)
        } else {
            // Back side (un-mirror the text)
            Box(Modifier.graphicsLayer { rotationY = 180f }) {
                CardBack(word = word, vocabWord = vocabWord)
            }
        }
    }
}

@Composable
private fun CardFront(word: String, vocabWord: VocabWord) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(Spacing.xxl),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = word,
            fontSize = 34.sp,
            fontWeight = FontWeight.Bold,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurface
        )

        vocabWord.phonetic?.takeIf { it.isNotBlank() }?.let {
            Spacer(Modifier.height(Spacing.sm))
            Text(
                text = it,
                fontSize = 15.sp,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
            )
        }

        val context = vocabWord.contexts?.firstOrNull()?.sentence
        if (!context.isNullOrBlank()) {
            Spacer(Modifier.height(Spacing.xxl))
            Text(
                text = "例句",
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f)
            )
            Spacer(Modifier.height(Spacing.sm))
            HighlightedSentence(sentence = context, word = word)
        }
    }
}

@Composable
private fun CardBack(word: String, vocabWord: VocabWord) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(Spacing.xxl),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "释义",
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f)
        )
        Spacer(Modifier.height(Spacing.sm))
        Text(
            text = vocabWord.definition ?: "暂无释义",
            fontSize = 18.sp,
            fontWeight = FontWeight.Medium,
            textAlign = TextAlign.Center,
            color = MaterialTheme.colorScheme.onSurface
        )

        val context = vocabWord.contexts?.firstOrNull()?.sentence
        if (!context.isNullOrBlank()) {
            Spacer(Modifier.height(Spacing.xxl))
            Text(
                text = "例句",
                fontSize = 12.sp,
                fontWeight = FontWeight.Medium,
                color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.4f)
            )
            Spacer(Modifier.height(Spacing.sm))
            HighlightedSentence(sentence = context, word = word)
        }
    }
}

@Composable
private fun HighlightedSentence(sentence: String, word: String) {
    val annotated = buildAnnotatedString {
        val lower = sentence.lowercase()
        val parts = word.lowercase().split(Regex("[\\s.…]+")).filter { it.isNotEmpty() }
        var lastIdx = 0

        for (part in parts) {
            val idx = lower.indexOf(part, lastIdx)
            if (idx == -1) continue
            // Text before match
            if (idx > lastIdx) {
                withStyle(SpanStyle(fontStyle = FontStyle.Italic, color = Color.Gray)) {
                    append(sentence.substring(lastIdx, idx))
                }
            }
            // Highlighted match
            withStyle(SpanStyle(fontWeight = FontWeight.Bold, color = AppColors.Accent)) {
                append(sentence.substring(idx, idx + part.length))
            }
            lastIdx = idx + part.length
        }
        // Remaining text
        if (lastIdx < sentence.length) {
            withStyle(SpanStyle(fontStyle = FontStyle.Italic, color = Color.Gray)) {
                append(sentence.substring(lastIdx))
            }
        }
    }

    Text(
        text = annotated,
        fontSize = 16.sp,
        textAlign = TextAlign.Center,
        lineHeight = 24.sp
    )
}
