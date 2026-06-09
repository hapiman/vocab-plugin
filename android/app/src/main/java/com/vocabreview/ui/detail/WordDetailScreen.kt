package com.vocabreview.ui.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material.icons.filled.FormatQuote
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.vocabreview.data.VocabRepository
import com.vocabreview.domain.DateCoding
import com.vocabreview.ui.components.GradientButton
import com.vocabreview.ui.components.SecondaryButton
import com.vocabreview.ui.components.StatusBadge
import com.vocabreview.ui.theme.AppColors
import com.vocabreview.ui.theme.Radius
import com.vocabreview.ui.theme.Spacing

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WordDetailScreen(
    word: String,
    onBack: () -> Unit,
    viewModel: WordDetailViewModel = viewModel()
) {
    val words by VocabRepository.get().words.collectAsStateWithLifecycle()
    val vocabWord = words[word]

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("详情") },
                navigationIcon = {
                    IconButton(onClick = onBack) {
                        Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = "返回")
                    }
                }
            )
        }
    ) { padding ->
        if (vocabWord == null) {
            Box(Modifier.fillMaxSize().padding(padding), contentAlignment = Alignment.Center) {
                Text("单词不存在")
            }
            return@Scaffold
        }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = Spacing.xl, vertical = Spacing.lg)
        ) {
            // Header card
            DetailCard {
                Text(
                    text = word,
                    fontSize = 32.sp,
                    fontWeight = FontWeight.Bold
                )
                Spacer(Modifier.height(Spacing.sm))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    vocabWord.phonetic?.takeIf { it.isNotBlank() }?.let {
                        Text(
                            text = it,
                            fontSize = 15.sp,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
                        )
                        Spacer(Modifier.width(Spacing.md))
                    }
                    StatusBadge(status = vocabWord.status)
                }
            }

            Spacer(Modifier.height(Spacing.md))

            // Definition card
            DetailCard {
                SectionHeader(icon = Icons.Default.MenuBook, title = "释义")
                Spacer(Modifier.height(Spacing.sm))
                Text(
                    text = vocabWord.definition ?: "暂无释义",
                    fontSize = 16.sp,
                    color = MaterialTheme.colorScheme.onSurface
                )
            }

            Spacer(Modifier.height(Spacing.md))

            // Context card
            if (!vocabWord.contexts.isNullOrEmpty()) {
                DetailCard {
                    SectionHeader(icon = Icons.Default.FormatQuote, title = "例句")
                    vocabWord.contexts?.forEachIndexed { idx, ctx ->
                        if (idx > 0) Spacer(Modifier.height(Spacing.md))
                        Spacer(Modifier.height(Spacing.sm))
                        Text(
                            text = ctx.sentence ?: "",
                            fontSize = 15.sp,
                            fontStyle = FontStyle.Italic,
                            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.8f),
                            lineHeight = 22.sp
                        )
                        ctx.url?.let { url ->
                            Text(
                                text = try {
                                    java.net.URL(url).host
                                } catch (_: Exception) { url.take(40) },
                                fontSize = 12.sp,
                                color = AppColors.Accent.copy(alpha = 0.7f)
                            )
                        }
                    }
                }
                Spacer(Modifier.height(Spacing.md))
            }

            // Info card
            DetailCard {
                SectionHeader(icon = Icons.Default.Info, title = "信息")
                Spacer(Modifier.height(Spacing.sm))
                InfoRow("加入", vocabWord.firstSeen ?: "未知")
                InfoRow("更新", vocabWord.lastSeen ?: vocabWord.firstSeen ?: "未知")
                InfoRow("复习", "${vocabWord.reviewCount ?: 0} 次")
                InfoRow("到期", DateCoding.formatDueDisplay(vocabWord.dueAt))
            }

            Spacer(Modifier.height(Spacing.xxl))

            // Actions
            GradientButton(
                text = if (vocabWord.status == "mastered") "重新学习" else "标记已掌握",
                onClick = { viewModel.toggleStatus(word) }
            )

            Spacer(Modifier.height(Spacing.md))

            SecondaryButton(
                text = "设为今天复习",
                onClick = { viewModel.setDueToday(word) },
                enabled = vocabWord.status != "mastered"
            )

            // Status message
            viewModel.statusMessage?.let { msg ->
                Spacer(Modifier.height(Spacing.md))
                Text(
                    text = msg,
                    fontSize = 14.sp,
                    color = AppColors.StatMastered
                )
            }

            Spacer(Modifier.height(Spacing.xxxl))
        }
    }
}

@Composable
private fun DetailCard(content: @Composable ColumnScope.() -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(Radius.large))
            .background(MaterialTheme.colorScheme.surface)
            .padding(Spacing.xl),
        content = content
    )
}

@Composable
private fun SectionHeader(icon: androidx.compose.ui.graphics.vector.ImageVector, title: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(
            imageVector = icon,
            contentDescription = null,
            modifier = Modifier.size(18.dp),
            tint = AppColors.Accent
        )
        Spacer(Modifier.width(Spacing.sm))
        Text(
            text = title,
            fontSize = 14.sp,
            fontWeight = FontWeight.SemiBold,
            color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f)
        )
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
        horizontalArrangement = Arrangement.SpaceBetween
    ) {
        Text(text = label, fontSize = 14.sp, color = MaterialTheme.colorScheme.onSurface.copy(alpha = 0.5f))
        Text(text = value, fontSize = 14.sp)
    }
}
