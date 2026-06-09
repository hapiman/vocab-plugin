package com.vocabreview.ui.vocabulary

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vocabreview.model.VocabWord
import com.vocabreview.ui.components.StatusBadge
import com.vocabreview.ui.theme.Radius
import com.vocabreview.ui.theme.Spacing

@Composable
fun WordListItem(
    index: Int,
    word: String,
    vocabWord: VocabWord,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Radius.medium))
            .background(MaterialTheme.colorScheme.surface)
            .clickable(onClick = onClick)
            .padding(Spacing.lg),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Index
        Text(
            text = index.toString(),
            fontSize = 15.sp,
            fontWeight = FontWeight.Bold,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.3f),
            modifier = Modifier.width(28.dp)
        )

        Spacer(Modifier.width(Spacing.md))

        // Word + Definition
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = word,
                fontSize = 18.sp,
                fontWeight = FontWeight.SemiBold,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis
            )
            vocabWord.definition?.takeIf { it.isNotBlank() }?.let {
                Spacer(Modifier.height(Spacing.xs))
                Text(
                    text = it,
                    fontSize = 14.sp,
                    color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.6f),
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }

        Spacer(Modifier.width(Spacing.md))

        // Status badge
        StatusBadge(status = vocabWord.status)
    }
}
