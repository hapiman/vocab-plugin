package com.vocabreview.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.vocabreview.ui.theme.AppColors

@Composable
fun StatusBadge(status: String?, modifier: Modifier = Modifier) {
    val isLearning = status == "learning"
    val bgColor = if (isLearning) AppColors.StatLearning.copy(alpha = 0.12f)
    else AppColors.StatMastered.copy(alpha = 0.12f)
    val textColor = if (isLearning) AppColors.StatLearning else AppColors.StatMastered
    val label = if (isLearning) "学习中" else "已掌握"

    Box(
        modifier = modifier
            .clip(RoundedCornerShape(4.dp))
            .background(bgColor)
            .padding(horizontal = 8.dp, vertical = 4.dp)
    ) {
        Text(
            text = label,
            fontSize = 12.sp,
            fontWeight = FontWeight.Medium,
            color = textColor
        )
    }
}
